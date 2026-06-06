# Stage 2 — Data Pipeline

_Read `00-OVERVIEW.md`, `01-bootstrap.md`, the SPEC `§7` data architecture section, and the `2026-06-06` entries in `DECISIONS.md` (cadence, two-branch delivery, Subtensor fallback) before any code. Run this stage on the latest available Claude Opus. Stop-and-confirm at the Stage 2 boundary — do not start Stage 3._

## What this stage is

The honest-data spine. A per-Yuma-epoch (~72 min, ~20/day) snapshot of Bittensor subnet aggregates pulled from the **Taostats** free-tier API, with a **`@polkadot/api` Subtensor fallback** when Taostats is unavailable, written to `data/network.ndjson` (append-only history) and pivoted into `static/network.json` (latest state for the browser).

Snapshots commit to a **`data` branch** of this repo; Cloudflare Pages keeps watching only `main`, so the site doesn't redeploy on every snapshot. The browser will fetch `network.json` via **jsDelivr** (`https://cdn.jsdelivr.net/gh/hmgovt/metagraphs@data/static/network.json`) — but this stage does **not** wire the browser fetch yet (that lands in Stage 4 alongside the field).

No visualisation work in this stage. No rendering, no Three.js. Just data, schema, and the workflow that keeps both honest.

## Step 0 — Comprehension (before writing any code)

Read in this order:

1. `docs/handoff/00-OVERVIEW.md` (the concept, the seven D1–D7 decisions, what's out of scope)
2. `SPEC.md §7` (data architecture) and `§9` (engineering constraints)
3. `DECISIONS.md` — specifically the `2026-06-06` entries documenting:
   - **D8** — per-epoch snapshot cadence
   - **D9** — two-branch data delivery (`data` branch + jsDelivr)
   - **D10** — `@polkadot/api` Subtensor fallback inside Stage 2
4. The Stage 1 holding page at `src/routes/+page.svelte` (so you can see the "as of —" stamp the data layer will populate later)

Then, before writing a line of code:

- Summarise back, in your own words: the snapshot cadence and why epoch alignment matters (D8 + the heartbeat in SPEC §3.2); the two-branch delivery model and why it exists (D9); the fail-soft contract; the real-revenue formula's inputs and what its weights are saying (SPEC §3.3.1); what is explicitly **not** in this stage (the field, the colour wiring, the scrubber, R2 migration, Python `btcli`).
- Verify the Taostats rate limit is still 5 requests per minute (confirmed during planning, 2026-06-06 — no separate daily cap was documented). If their docs have changed, surface it before coding.
- List anything ambiguous or that you'd push back on. If nothing is blocking, proceed.

## Step 1 — Pin the schema in `SPEC.md` and `static/network.schema.json`

Before any fetch code: extend `SPEC.md §7` with a `§7.4 Snapshot schema` subsection containing the schema below, and write a matching `static/network.schema.json` (JSON Schema draft 2020-12) that machines can validate against. The schema is the contract the rest of the stage builds against.

```jsonc
{
	"schemaVersion": 1,
	"asOf": "2026-06-06T02:14:00Z", // ISO 8601 UTC at snapshot time
	"epoch": 1234567, // chain epoch index (block height / 360)
	"block": 444444120, // block height at snapshot time
	"stale": false, // true when the snapshot couldn't refresh
	"source": "taostats", // "taostats" | "subtensor"
	"totalSubnets": 128,
	"subnets": [
		{
			"uid": 0,
			"name": "root", // null when name is not registered/known
			"emissionShare": 0.0123, // 0..1, fraction of this epoch's emission
			"alphaPrice": 0.042, // TAO per alpha
			"marketCap": 12345.67, // TAO
			"validators": 64,
			"miners": 256,
			"realRevenueSignal": null, // 0..1 or null (see Step 6)
			"signalSource": null, // "taostats" | "computed:v1" | null
			"registeredAtBlock": 4123000 // null if not provided
		}
		// … one entry per active subnet, sorted by uid ascending
	],
	"events": {
		"registrations": [{ "uid": 47, "atBlock": 1234500 }],
		"deregistrations": [{ "uid": 23, "atBlock": 1234480 }]
	}
}
```

Subnets are an **array sorted by uid**, not an object map. The breathing field iterates positions; lookups happen by index. Keep this shape stable — the browser will rely on positional rendering.

## Step 2 — Add tooling deps

Append to `package.json` (`devDependencies` for the script runner, `dependencies` for runtime that may eventually be imported by the app):

- `tsx` — TypeScript script runner (BWI pattern; matches what `scripts/fetch-daily.ts` uses).
- `dotenv` — load `.env` locally only (CI uses the secret directly via `env:`).
- `@polkadot/api` — Substrate client for the Subtensor fallback (D10).
- `ajv` and `ajv-formats` — schema validation against `network.schema.json`.

Add npm scripts:

```jsonc
{
	"snapshot:fetch": "tsx scripts/fetch-snapshot.ts",
	"snapshot:build": "tsx scripts/build-network-json.ts",
	"snapshot:validate": "tsx scripts/validate-snapshot.ts",
	"snapshot": "npm run snapshot:fetch && npm run snapshot:build && npm run snapshot:validate"
}
```

No `snapshot:bootstrap` — the fetch script handles empty-NDJSON as a normal first-run case.

## Step 3 — Sources + fetchers

Mirror BWI's `scripts/{sources,fetchers}.ts` shape (`/Users/oceanair/Projects/bitcoinweighin/scripts/` — read first, copy structure not contents).

- **`scripts/sources.ts`** — Taostats endpoint config (URLs, field map, expected response shape), plus the Subtensor RPC endpoint URL and the storage keys to query as fallback.
- **`scripts/fetchers-taostats.ts`** — REST fetcher with the BWI `fetchWithRetry` pattern: exponential backoff on 429, URL redaction in logs (the API key in `Authorization: Bearer` or query param — verify which Taostats uses), return `FetchResult { data, httpStatus, rowCount, url }`. Pace calls at the documented free-tier limit (currently 5/min — sleep 12 s between calls, with jitter).
- **`scripts/fetchers-subtensor.ts`** — `@polkadot/api` connection to a public Subtensor endpoint (e.g. `wss://entrypoint-finney.opentensor.ai`). Query the same fields as Taostats (subnet count, per-subnet emission, validator/miner counts, alpha price/market cap, registration events). Translate the storage-format output into the same internal row shape so the orchestrator doesn't care which source it came from.

Never log the API key. Use `redactUrl` and `redactHeaders` helpers.

## Step 4 — Snapshot orchestrator

`scripts/fetch-snapshot.ts`:

1. Read the current chain block + epoch via the fallback Subtensor connection (cheap — needed for dedup either way; one WS query).
2. **Epoch dedup.** Read the last line of `data/network.ndjson`. If `lastRow.epoch === currentEpoch`, log `Already have epoch N, skipping` and exit 0 — no commit. This is the key idempotency lever that makes the `*/10 * * * *` cron safe.
3. **Primary path: Taostats.** Try the bulk subnet-list endpoint plus the ~1–2 supporting endpoints needed for the schema. If every required endpoint succeeds, build a row with `"source": "taostats"`.
4. **Fallback: Subtensor.** If Taostats's bulk endpoint errors after retries OR if a critical field is missing, switch to `@polkadot/api` and build the row from chain state. Mark `"source": "subtensor"`.
5. **Forward-fill per field.** If both sources are missing a non-critical field (e.g. one subnet's alpha price), forward-fill from the previous NDJSON row (BWI pattern; mark in health).
6. **Hard-fail only when both sources fail entirely AND there is no previous row to reuse.** Otherwise: rewrite `static/network.json` with the previous snapshot's body but a fresh `asOf` and `"stale": true`; exit 0; the workflow still commits the stale marker so the site shows honest stale data. The site never serves a fabricated value.
7. Append the new row to `data/network.ndjson` (one JSON object per line).
8. Write `static/network-meta.json` — combines BWI's `health.json` and `meta.json`: per-endpoint status (ok / forward-filled / fallback / failed), `lastRun`, `epoch`, `block`, `source`, redacted URLs, and the running window of "as of" timestamps for the last ~20 snapshots.

## Step 5 — Pivot

`scripts/build-network-json.ts`:

1. Read the last line of `data/network.ndjson`.
2. **Derive events.** Read the second-to-last NDJSON line, diff the subnet set: any uid present today but not yesterday → registration; any uid present yesterday but not today → deregistration. (Q4 from planning: derive, don't fetch.)
3. Write `static/network.json` matching the schema in Step 1. Sorted-by-uid array.
4. Estimate gzip size; warn at > 500 KB (we're nowhere near this with subnet aggregates but the canary catches schema regressions that bloat the payload).

## Step 6 — Real-revenue signal

The honesty layer's core signal (`realRevenueSignal`, 0..1). The **v1 formula is pinned in `SPEC.md §3.3.1`** — read it carefully before implementing.

Two-tier resolution:

1. **Tier A — Taostats direct field.** If Taostats exposes a field for paid AI usage / real demand (check their current docs), use it as-is. Set `signalSource: "taostats"`. The schema permits any 0..1 value here; the spec formula in §3.3.1 is the fallback, not the only allowed shape.
2. **Tier C — Computed per the SPEC §3.3.1 formula.** Implement the formula exactly as written. All inputs (`marketCap`, `miners`, `validators`, `registeredAtBlock`, current `block`, plus history from NDJSON for `historicalEmissionShare`) are already in the schema. Mark `signalSource: "computed:v1"`, or `"computed:v1-low-confidence"` for the brand-new-subnet edge case (`cumulativeEmissionApprox == 0`).
3. If `marketCap` is missing entirely for a subnet, leave `realRevenueSignal: null` and `signalSource: null` per §3.3.1's edge-case clause — the cell will render as the labelled neutral state.

If implementation forces a deviation from the §3.3.1 formula (e.g. an input field turns out to be unavailable from Taostats AND chain), **stop and update SPEC.md first**, then code. The colour code on the breathing field is load-bearing for D4 — its definition must stay reviewable in the spec, not buried in a script.

## Step 7 — Schema validation

`scripts/validate-snapshot.ts` loads `static/network.json` and validates it against `static/network.schema.json` using ajv. Wire it into `npm run snapshot` and the workflow as the last step before commit. A schema-invalid snapshot must fail the workflow loudly — better to leave yesterday's snapshot than serve a malformed one.

## Step 8 — The `data` branch + workflow

Replace `.github/workflows/snapshot.yml` (currently a stub). Shape:

```yaml
on:
  schedule:
    - cron: '*/10 * * * *' # every 10 min; orchestrator deduplicates by epoch
  workflow_dispatch: {}

permissions:
  contents: write

concurrency:
  group: snapshot
  cancel-in-progress: false
```

Steps:

1. Checkout `data` branch (creating it from `main` on first run via `git switch -c data main` if it doesn't exist).
2. Setup Node from `.nvmrc`, `npm ci`.
3. `npm run snapshot:fetch` (idempotent via epoch dedup).
4. If the script wrote nothing (same epoch), exit clean — no commit, no push.
5. `npm run snapshot:build && npm run snapshot:validate`.
6. Commit + push to `data` only, message `chore(snap): epoch N at YYYY-MM-DDTHH:MMZ` (one logical unit, easy to filter in `git log`).

**Cloudflare Pages must keep watching only `main`.** Verify in the Pages dashboard: Settings → Builds & deployments → "Production branch" stays `main`; under "Branch deployments", set `data` to "None" (do not build preview deployments for snapshots either).

## Step 9 — Wire the data-source URL constant

Add `src/lib/data-source.ts` exporting:

```ts
export const NETWORK_JSON_URL =
	'https://cdn.jsdelivr.net/gh/hmgovt/metagraphs@data/static/network.json';
export const NETWORK_META_URL =
	'https://cdn.jsdelivr.net/gh/hmgovt/metagraphs@data/static/network-meta.json';
```

Do **not** consume this anywhere yet — Stage 4 wires it to the field. The constant landing in Stage 2 just keeps the URL co-located with the pipeline that produces it.

## Step 10 — README + PROJECT-STATUS

Update `README.md` to document the new `npm run snapshot` flow for local development (with `.env`) and the data-branch / jsDelivr architecture. Update `PROJECT-STATUS.md` to "Stage 2 complete; Stage 3 next" and clear the "Stage 3 overlap" note now that Stage 2 has actually shipped data.

## Step 11 — Commit, push, report, stop

- Small logical commits on `main` (scripts, schema, workflow, README — _not_ snapshot data).
- The first snapshot commit lands on the `data` branch via the workflow's first `workflow_dispatch` run; manually trigger that run from the Actions UI as Stage 2's final act and confirm `cdn.jsdelivr.net/gh/hmgovt/metagraphs@data/static/network.json` returns valid JSON within ~10 min of the push (jsDelivr's purge interval).
- Push, confirm with `git log origin/main --oneline -10` and `git log origin/data --oneline -3`.
- Report: the schema, the fetch/fallback/dedup story, the workflow cadence, the first snapshot's "as of" stamp and epoch, the jsDelivr URL returning valid JSON. Then **STOP**. Do not begin Stage 3.

## Out of scope for this stage (do not build)

- The breathing field, cell rendering, any Three.js (Stage 4)
- Wiring the honesty colouring formula to actual cell render (Stage 5 — Stage 2 only defines the formula in SPEC and computes the number)
- Time-lapse history pivot / scrubber (Stage 7 — Stage 2 only writes the NDJSON history; rendering it is later)
- Cloudflare R2 migration of `network.json` (deferred to Stage 7+ hardening if jsDelivr ever proves insufficient)
- Python `btcli` / `bittensor` SDK (replaced by `@polkadot/api` per D10)
- Per-subnet weight matrices `subnet.W` (Phase 2, never in v1)
- Sonification, scrubber UI, time-lapse controls (Stage 7)
- The delegate panel (Stage 6)

If a step here seems to require any of the above to "look complete," stop and surface it.

## Constraints

- **Keys never in chat, commits, or logs.** Taostats API key only in `.env` locally and in repo Actions secrets. Use URL redaction in any log line that might include the key.
- **Pace Taostats calls.** Free tier is 5/min — sleep 12 s + jitter between calls. Verify their daily cap in Step 0; if it's tight, document in `network-meta.json` so the workflow can surface a quota warning.
- **The Subtensor RPC is a public good — don't hammer it.** One connection per workflow run, close it cleanly with `await api.disconnect()`.
- **Honest data.** Forward-fill is honest (it's labelled). Fabricating a value is not. Missing fields are `null`; the cell will render as the labelled neutral state.
- **Schema is a contract.** Any field added or removed needs to bump `schemaVersion` and update `network.schema.json` + the SPEC subsection in the same commit.
- **Spec is the source of truth.** If implementation forces a schema change, update the spec _first_, in the same commit.
- **"Done" requires a live jsDelivr fetch.** Tests + clean build + green workflow are necessary, not sufficient. The stage closes only when `curl https://cdn.jsdelivr.net/gh/hmgovt/metagraphs@data/static/network.json` returns valid JSON validating against the schema and reflects a recent epoch.
- **Small commits, conventional messages.** Workflow commits to `data` use `chore(snap):`; code commits to `main` use `feat:` / `chore:` / `docs:`.
