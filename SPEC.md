# Metagraphs — Specification

_Source of truth for what Metagraphs is and how it behaves. If implementation drifts from this document, the implementation is wrong — unless the drift surfaces a real bug in the spec, in which case stop and update the spec before coding around it._

Last revised: 2026-06-07 (Stage 4 hero-scale reshape — §3.1 honesty colour wired at Stage 4 per D11, §3.7 microscope zoom per D12, §3.8 owner-declared subnet logos, §7.4 schema bumped to v2 for `logoUrl`, §10 status). Tracks the locked decisions in [`DECISIONS.md`](DECISIONS.md). Current implementation progress in [`PROJECT-STATUS.md`](PROJECT-STATUS.md).

---

## 1. What this is

Metagraphs renders the Bittensor network not as a dashboard but as a **living organism**.

The macro view is a field of the network's ~128 subnets, each a glowing cell. They are fed by the **emission heartbeat** — the Yuma Consensus epoch, which resolves every ~72 minutes (360 blocks at ~12 s each, ~20 beats per day). On each beat, cells swell as they drink emissions, glow warm when the work the subnet is doing is real paid AI work and cold when it is merely farming subsidy, and wink out when the market starves them. A new subnet ignites in the freed slot.

It is grounded entirely in real on-chain data, honest about the ugly parts of the network, and built to be left open all day and watched. We are the network's **portrait**, not its instrument.

Canonical domain: `metagraphs.live`. `metagraphs.app`, `metagraphs.io`, and singular `metagraph.live` are registered defensively and redirect to the canonical.

## 2. Network facts the visualisation is grounded in

These are behavioural facts of Bittensor, not display assumptions; they are pinned to behaviour not price, so they survive snapshot churn.

- **~128 active subnets** (hard cap at session date; 256 expansion planned later 2026, handled as a config value not a magic number).
- **21M TAO hard cap.** No pre-mine, no VC.
- **First halving December 2025** cut emissions ~7,200 → ~3,600 TAO/day (~0.5 TAO/block; block ≈ 12 s).
- **Yuma Consensus epoch = 360 blocks ≈ 72 minutes ≈ 20 beats/day.** On each beat, validator weight matrices resolve into miner/validator emissions. This pulse is the spine of the whole visualisation.
- **dTAO is live.** Each subnet has its own alpha token and AMM; staked TAO votes emissions toward subnets. The May 2026 refactor concentrated emissions on roughly the top ~30 subnets — visible in the field as a few bright cells and a long cold tail.
- **Validator economics:** a validator permit goes to the top 64 by stake per subnet; default validator take is 18%. Relevant only to the delegate panel.

Price is volatile and refreshes from the daily snapshot — never hard-code TAO price.

## 3. v1 scope (what ships)

### 3.1 The macro view

The breathing field of ~128 subnets as the hero. Each subnet is a single cell whose appearance encodes:

- **Size** — relative emission share (how much of the day's emission is flowing into this subnet).
- **Heat / colour temperature** — the _honesty layer_: warm hues when the subnet shows real paid AI work, cold hues when it primarily farms subsidy. Heat reuses the BWI Pu-238 blackbody-glow approach, separating an intensity channel (how bright) from a colour-temperature channel (how warm).
- **Pulse phase** — synced to the Yuma epoch heartbeat (see §3.2).
- **Lifecycle state** — ignition for new registrations, death for deregistrations.

A cell is clickable, but in v1 the click opens a no-op placeholder reading "subnet detail coming soon" — the micro view is Phase 2 (see §6).

**Positional layout (v1 commitment, Stage 4).** Each subnet's screen position is a deterministic function of its `uid` via Vogel sunflower phyllotaxis: `angle = uid × goldenAngle`, `radius = √(uid / MAX_SUBNETS) × R_field`. Subnet 0 (root) sits at the centre; new high-uid subnets ignite at the rim. The cap is a config constant, not a magic number — `MAX_SUBNETS = 256` from day one, so the future 256-cap expansion does not scramble positions, even though only ~128 uids are lit today. Cell positions are stable across snapshots: deregistered uids leave dark slots, registrations re-light their original slot at the next epoch the chain assigns that uid.

**Size encoding (v1).** `radius ∝ √(emissionShare)`, clamped to `[R_min, R_max]`; null emissionShare renders at `R_min`. Area-proportional, not radius-proportional, so the perceived "how much" matches share intuition.

**Glow shader (v1).** A single-quad billboard per cell with additive blending, soft Gaussian core + halo. The shader carries two **separated channels** — `aIntensity` and `aTemperature` — reusing the BWI Pu-238 principle. Stage 4 wires both: intensity from `emissionShare` (size and brightness reinforce), temperature from `realRevenueSignal` per cell (D11 — the honesty axis lands on day one, not at Stage 5). The temperature axis interpolates a 3-stop perceptual gradient `cold (#1e6f8a) ↔ mid (#c8d8d0) ↔ warm (#f0bc76)` rather than a Planckian curve — a literal blackbody passes through orange-red at low temperatures, which would read as "alert / danger," exactly the wrong register for the honesty axis. Subnets with `realRevenueSignal === null` render at the neutral mid temperature (§3.3 labelled neutral state); subnets with a computed signal render along the cold→warm axis.

**Hero framing (v1).** The field is the page, not a panel inside it. `<main>` sizes to the full viewport; the wordmark and the telemetry strip overlay it as small floating dim-mono blocks (gradient backings for legibility, never solid bars). Pulse opacity drops to 0.35 once data lands so the cells are the brightest objects on screen.

### 3.2 The heartbeat

A real pulse, not a metaphor. One soft swell per Yuma epoch (~72 min in real-time, compressed in time-lapse). On each beat:

- Emission flows visibly into each cell proportional to its share for that epoch.
- Honesty colouring updates from the latest snapshot's real-revenue signal.
- Lifecycle events (registrations, deregistrations) animate as ignitions / deaths.

### 3.3 The honesty layer

Mandatory, not decorative. The visualisation surfaces what an insider dashboard hides:

- Emission-farming / subsidy-only subnets render cold; subnets with real paid AI usage render warm.
- Deregistrations are deaths; new registrations are ignitions.
- Owner-burn and the lopsided "one miner takes everything" distributions are surfaced, not hidden.
- **A mismatch between what we render and chain state is a product bug, not an edge case.**

Where data is missing or stale, the cell renders as a labelled neutral state with an "as of" note — never a fabricated number.

#### 3.3.1 Real-revenue signal — v1 formula

The number that drives the warm/cold rendering. A 0..1 score per subnet, computed deterministically from the fields already in the snapshot schema (§7.4) plus the running NDJSON history. 1 = market and participation suggest real productive use. 0 = the network is paying this subnet and nothing arms-length agrees it's worth it.

For each subnet `s` at snapshot block `B`:

- `age_blocks_s = B − registeredAtBlock_s` (0 if `registeredAtBlock` is null)
- `historicalEmissionShare_s` = arithmetic mean of this subnet's `emissionShare` across all `data/network.ndjson` rows where the subnet was present. Falls back to current `emissionShare_s` when no history exists.
- `cumulativeEmissionApprox_s = age_blocks_s × 0.5 × historicalEmissionShare_s` (~0.5 TAO/block post-halving, weighted by this subnet's share)

Three sub-signals:

| Symbol | Formula                                                | Range | Meaning                                                                                   |
| ------ | ------------------------------------------------------ | ----- | ----------------------------------------------------------------------------------------- |
| `M_s`  | `clamp(marketCap_s / cumulativeEmissionApprox_s, 0,1)` | 0..1  | Market endorsement: does the alpha market value the subnet above the TAO emitted into it? |
| `P_s`  | `min(miners_s / 256, 1)`                               | 0..1  | Miner participation: how saturated is the worker pool?                                    |
| `V_s`  | `validators_s / 64`                                    | 0..1  | Validator engagement: how saturated is the judge pool?                                    |

Weighted sum:

```
RealUseSignal_s = 0.6·M_s + 0.2·P_s + 0.2·V_s
```

**Edge cases:**

- `cumulativeEmissionApprox_s == 0` (subnet registered this epoch or `registeredAtBlock` unknown): `M_s` is undefined. Fall back to `RealUseSignal_s = (P_s + V_s) / 2` and tag `signalSource: "computed:v1-low-confidence"`.
- `marketCap_s == null` (data missing): `RealUseSignal_s = null` and `signalSource: null`. Cell renders as the labelled neutral state per §3.3.
- `historicalEmissionShare_s == 0` (subnet appeared in history but never earned): `M_s = 0`. The signal effectively drops to `0.2·P_s + 0.2·V_s` — small but non-zero, since zero earnings on a subnet that exists is itself a strong "this is dead weight" signal.

**Why the 0.6 / 0.2 / 0.2 weighting.** The alpha market is the only arms-length voter we have access to without per-validator weight matrices (which are Phase 2). A subnet that has been emitted ~10 K TAO over a year but whose alpha market cap sits at ~3 K TAO is being explicitly devalued by the market — that's the cleanest "no real demand" signal in the network. Participation and engagement are coarse proxies that move with real use but can be sybil-faked; they smooth `M_s`'s short-term volatility without dominating it.

**What this catches:** the long tail of subsidy-farming subnets with collapsed alpha prices renders cold. Subnets whose alpha caps exceed cumulative emissions render warm.

**What it misses (honest disclosure):** a genuinely new useful subnet may read cold for its first weeks while the market discovers it. A speculative pump-and-dump can read warm briefly. A sybil network with co-ordinated validator + miner stake may register as "saturated" until the market signal eventually catches up. These are known limitations of `v1`; the Phase-2 micro dive's per-subnet weight-matrix entropy will refine `M_s` into a properly distribution-aware score, at which point the formula version bumps to `v2`.

**Stability:** deterministic, no inputs beyond `network.json` + the running NDJSON history. Idempotent across re-runs of the same snapshot.

**Versioning:** when the formula changes, bump `signalSource` from `"computed:v1"` to `"computed:v2"` (etc.) and append a new dated entry in `DECISIONS.md`. Never silently re-weight; the colour code on the field is load-bearing for the brand.

### 3.4 Time and sound

- **Default playback** is a gentle time-lapse of the most recent real beats, looping, labelled honestly as time-lapsed.
- **Date/time scrubber** lets the viewer travel the network's life: dTAO launch, the December 2025 halving, the May 2026 refactor. Reuses the BWI date-scrubber pattern.
- **Sonification** — one soft sub-bass thud per epoch; each subnet hums a faint tone so the field is a slowly re-voicing chord. **Opt-in, off by default**, persisted via URL state (same pattern as the BWI Geiger crackle).
- Scrubber and sound are the lightest-priority items in v1; if a stage runs long, they degrade to a follow-up before anything earlier is compromised.

### 3.5 Delegate-to-power-this

A panel ships in v1, wired to a **partner validator** on a revenue-share basis. TAO-native equivalent of the BWI Lightning tip jar, but recurring yield instead of one-off sats.

- Architected to **repoint to our own validator hotkey later without a redesign** (graduation path: partner now → own validator once delegation volume and ops justify it).
- **Our own (future) validator renders as a living cell inside the organism** so a user can watch the stake they just delegated flow in on the next heartbeat. The tool that visualises the incentive network is itself a node in it.
- **No private keys, seed phrases, or signing flows are handled by us.** Delegation is initiated through the user's own wallet. We display and direct; we never custody.

### 3.6 Honest-telemetry strip

A single monospace line of telemetry sits in the footer of every page from Stage 3 onward, reading from the live snapshot. It is a **load-bearing component of the honesty contract (D4), not chrome.** Format and states:

- **Fresh:** `as of {YYYY-MM-DD HH:MM UTC} · epoch {N} · {totalSubnets} subnets · source {taostats|subtensor}`.
- **Stale:** the line is prefixed `stale · …` whenever `network.json.stale === true`. The rest of the line stays visible — the user sees that the stamp they're reading _is_ stale.
- **Loading (no data yet):** `as of —` — the same baseline the Stage 1 holding page rendered. This is the SSR-prerendered baseline; hydration replaces it.
- **Unreachable (fetch failed):** `as of — · data unreachable`. No toast, no spinner, no error icon — D4's absence-surfaced-honestly contract forbids the dramatised version.

`asOf` always renders to minute precision (`YYYY-MM-DD HH:MM UTC`); the chain does not tick at second resolution and surfacing it would imply false freshness. The fetch cadence is 5 minutes (jsDelivr's TTL is ~10 min and the cron commits every 10 min, so 5 min keeps the page within one epoch of fresh); the visible **epoch pulse** is a Stage 5 concern and must not be coupled to the fetch cadence.

### 3.7 Microscope zoom

D12 permits zooming **into** the portrait. It does not permit panning across it or orbiting around it — those affordances tilt the experience into "explore a map," which D6 explicitly disavows. Concretely:

- **Scroll wheel / trackpad pinch** — zoom centred on the cursor. Bounded `[MIN_ZOOM, MAX_ZOOM]` (1.0 to 5.5 at the time of writing). `MIN_ZOOM = 1` frames the whole field; `MAX_ZOOM` frames roughly 4–5 cells across the viewport.
- **Double-click on a cell** — tween (~600 ms, easeOutCubic) toward the cell at a mid zoom level. Click on empty field at `MIN_ZOOM` is the existing tooltip dismissal; double-click on empty field resets to whole-field view.
- **Escape / `0` / `Home`** — reset to whole-field view.
- **No drag-to-pan.** When zoomed in, the viewer leans closer; they don't tour. To see a different region they zoom out first.
- **Camera position is clamped** so that no zoom + offset combination ever lets the field circle leave the viewport. The organism is always present.
- **Cell name labels** fade in past `NAME_LABEL_ZOOM_THRESHOLD` (~2.4) as small dim-mono DOM elements positioned by projecting cell coordinates to screen each frame. Labels are shown only for cells with `emissionShare > 0` — the meaningful ~30, not the cold-tail 98. Curiosity is rewarded with detail, not denied.

### 3.8 Subnet logos (owner-declared, schema v2)

Subnet logos render only as part of the cell name label (see §3.7), only at zoom past the label threshold, **never on the cell glow itself**. Including a logo on the unzoomed bioluminescent cell would tip the field into "sponsor wall" register, which violates D2 — the cell must stay an organism at the default view.

Logos are **owner-declared**: each subnet owner registers a `logo_url` via Taostats's identity endpoint. The snapshot pipeline issues **one bulk call** per Yuma epoch (`/api/subnet/identity/v1?limit=200`) that returns all subnets in a single response — that's the per-snapshot rate cost, and it's amortised the same way the existing per-epoch Taostats calls are. The resulting URLs are stored in `network.json` as `logoUrl: string | null` per subnet (§7.4, schema v2).

**Why a schema bump.** A deterministic-CDN approach (a single URL pattern derivable from `uid`) was considered first and rejected after probe: Taostats's `metadata` endpoint returns a URL pattern (`taostats.io/images/subnets/{uid}.webp`) that does not actually serve images — those URLs return the site's SPA 404 HTML. The owner-declared identity URLs are the only authentic source; carrying them through the snapshot is honest data architecture rather than a derived convention.

**Rendering rules:**

- `<img loading="lazy" referrerpolicy="no-referrer" alt="" onerror="...">` next to the name label, ~14 px circular crop.
- A `null` `logoUrl` means the owner has not registered a logo; the name renders without an icon. Never a broken-image icon, never a placeholder graphic.
- An owner-CDN URL that 404s (some are stale — one subnet literally points at `https://deprecated.png`) fails silently via `onerror`; the name label stays.
- `referrerpolicy="no-referrer"` so loading a logo never leaks the visitor's `metagraphs.live` referrer to owner CDNs.
- `loading="lazy"` so cold-tail-only viewers (who never zoom in) pay zero network cost for logos.

**Aesthetic caveat.** Owner-declared logos vary wildly in art style, aspect ratio, transparency handling, and brand quality. The 14 px circular crop + no-color-correct rendering accepts that variance honestly rather than trying to flatten it — the field is a portrait of the network, not a curated marketing surface.

## 4. Aesthetic rule (hard guardrail)

**Every blockchain visualiser on earth is glowing blue dots connected by lines on black. That look is failure.** If a screenshot of Metagraphs reads as "crypto network graph," it is a bug.

- Register is **physiological** — bioluminescent, neural, deep-ocean; something with a body temperature and a pulse, not a topology.
- Cell heat uses the BWI Pu-238 blackbody-glow approach (separate intensity and colour-temperature channels).
- **No node-link spaghetti. No force-directed hairball.** A body, not a diagram.

## 5. Positioning (what we do not do)

Taostats and TaoScope own the operator/analytics quadrant — fast tables for people debugging their own stake. We do not compete there; we lose on depth and speed and it isn't our game. We win on experience, emotion, and originality, which they explicitly disavow.

Concretely:

- No metagraph tables.
- No validator leaderboards-as-tables.
- No "compare" grids in v1.

The ambient, leave-it-open-and-watch-it-breathe quality is a feature, not an accident.

## 6. Out of scope for v1

These are explicitly out, surfaced to prevent drift:

- The **micro view** — single-subnet Yuma weight-matrix dive (validators judging miners, consensus forming, outliers clipped, emission flowing). The marquee Phase-2 feature. v1 keeps the conceptual hook (clickable cell → placeholder) and builds none of the matrix machinery.
- **Per-subnet full metagraph / `subnet.W` snapshots** (Phase 2 data work). v1 snapshots aggregates only.
- **Running our own validator.** v1 is partner-validator only.
- **Any key custody, signing, or transaction-submission flow.**
- `/data` page, checksums, provenance, Zenodo dataset path.
- Subnet-sponsored / bespoke hero cells.
- Newsletter capture, press kit, OG-image automation, video pipeline.
- 256-subnet expansion handling beyond keeping the cap a config value.

If a session feels pulled to any of these to "complete" something — stop and surface it instead of building.

## 7. Data architecture

The architecture mirrors BWI's honest-data spine, adapted for the Bittensor epoch rhythm. **All rendering math is client-side; no keys reach the browser.**

### 7.1 Snapshot pipeline

- A **GitHub Actions cron at `*/10 * * * *`** runs the snapshot job. Per D8, the maximum useful snapshot cadence is one per Yuma epoch (~72 min); the 10-minute cron guarantees we catch every epoch within ~10 min of its resolution. The orchestrator deduplicates by reading the current chain epoch and comparing to the last `data/network.ndjson` row — same epoch → exit 0 without writing or committing.
- Primary source: **Taostats free-tier REST API** (5 calls/min — paced with 12 s + jitter between calls; per-day cap not documented, surfaced in `network-meta.json` if hit).
- Fallback source (D10): **`@polkadot/api` over a public Subtensor RPC** (`wss://entrypoint-finney.opentensor.ai:443`). Queries the same fields directly from chain state when Taostats's bulk endpoint errors after retries. JavaScript-only toolchain — no Python `btcli` / `bittensor` SDK in CI.
- Outputs (per D9, written to a separate `data` branch of this repo, not `main`):
  - `data/network.ndjson` — append-only history, one snapshot per line.
  - `static/network.json` — latest snapshot pivoted into the §7.4 schema. This is Metagraphs' equivalent of BWI's `prices.json`.
  - `static/network.schema.json` — JSON Schema (draft 2020-12) the validator runs against on every commit. Also pinned to `main`.
  - `static/network-meta.json` — per-endpoint health, source (`taostats` | `subtensor`), `lastRun`, `epoch`, redacted URLs, running window of recent "as of" timestamps. Replaces and merges BWI's `health.json` + `meta.json`.
- Delivery (per D9): Cloudflare Pages watches **`main` only**, so snapshot commits do not redeploy the site (~20 snapshots/day would otherwise blow the CF Pages 500-build/month tier). The browser fetches the latest snapshot via **jsDelivr's GitHub CDN**: `https://cdn.jsdelivr.net/gh/hmgovt/metagraphs@data/static/network.json`. Migration to `data.metagraphs.live` (Cloudflare R2) is Stage 7+ hardening, conditional on jsDelivr proving insufficient.
- **Fail-soft contract:**
  - If a single Taostats endpoint fails after retries, fall back to Subtensor for that field.
  - If a single non-critical field is missing from both sources, forward-fill from the previous NDJSON row and mark in `network-meta.json` (BWI pattern — honest because labelled).
  - If both sources fail entirely AND no previous row exists: hard-fail, exit non-zero, leave previous snapshot in place.
  - If both sources fail entirely AND a previous row exists: rewrite `static/network.json` with the previous body but a fresh `asOf` and `"stale": true`; commit the stale marker; the site continues serving honest, labelled stale data. **Never crash; never fabricate a value.**

### 7.2 What v1 snapshots

Subnet-level **aggregates only**, one row per Yuma epoch:

- emission share
- alpha price
- market cap
- validator / miner counts
- real-revenue signal (Taostats direct field where available; otherwise computed per §3.3.1)
- owner-declared logo URL (schema v2, added 2026-06-07 — Taostats `/api/subnet/identity/v1?limit=200`, one bulk call per epoch; see §3.8)
- registration / deregistration events (derived in the pivot step by diffing the subnet set against the previous NDJSON row — not fetched)

Full per-subnet weight matrices (`subnet.W`) are heavy and belong to the Phase-2 micro dive — **do not pull them at v1**.

### 7.3 Secrets

- `TAOSTATS_API_KEY` lives in `.env` locally (gitignored) and in the repo's GitHub Actions secrets for scheduled runs.
- The Subtensor fallback uses a public RPC endpoint and requires no key.
- **Never** in chat, commits, `.env.example`, or printed output. All fetcher URLs are passed through a `redactUrl` helper before any log line; auth headers are redacted by a `redactHeaders` helper.

### 7.4 Snapshot schema

The contract the rest of the pipeline (and ultimately the browser) builds against. Pinned here so any change is reviewable in the spec, not buried in a script. A matching `static/network.schema.json` (JSON Schema draft 2020-12) is validated against every commit; a schema-invalid snapshot fails the workflow loudly and leaves the previous snapshot in place.

```jsonc
{
	"schemaVersion": 2,
	"asOf": "2026-06-07T16:14:00Z", // ISO 8601 UTC at snapshot time
	"epoch": 1234567, // chain epoch index (block height / 360)
	"block": 444444120, // block height at snapshot time
	"stale": false, // true when the snapshot couldn't refresh and is being re-served
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
			"realRevenueSignal": null, // 0..1 or null (see §3.3.1)
			"signalSource": null, // "taostats" | "computed:v1" | "computed:v1-low-confidence" | null
			"registeredAtBlock": 4123000, // null if not provided
			"logoUrl": "https://owner.example/logo.png" // null when owner has not registered one (added in v2; see §3.8)
		}
		// … one entry per active subnet, sorted by uid ascending
	],
	"events": {
		"registrations": [{ "uid": 47, "atBlock": 1234500 }],
		"deregistrations": [{ "uid": 23, "atBlock": 1234480 }]
	}
}
```

**Shape rules:**

- `subnets` is an **array sorted by uid ascending**, not an object map. The breathing field iterates positions; lookups happen by index. This shape is load-bearing for the macro view's positional rendering — keep it stable.
- Numeric fields use `null` (not `undefined`, not `0`, not `"-"`) for missing data, so the renderer can branch on `=== null` for the labelled neutral state per §3.3.
- `realRevenueSignal` and `signalSource` are produced per §3.3.1 — the formula is the source of truth, this schema is its contract.
- `logoUrl` is the owner-declared URL from Taostats's identity endpoint (per §3.8). `null` when the owner has not registered one. The pipeline does **not** verify the URL is reachable; broken / 404 / typo URLs (one current subnet literally registers `https://deprecated.png`) are the owner's statement and travel honestly through the snapshot. The browser handles broken URLs via `<img onerror>`.
- `events.registrations` and `events.deregistrations` may be empty arrays (no registrations this epoch is the steady state).

**Versioning.** Any field added or removed bumps `schemaVersion` and updates `network.schema.json` in the same commit. If implementation forces a schema change, **update this section first**, then code. **History:**

- **v1** (Stage 2): initial fields per the shape above.
- **v2** (2026-06-07, Stage 4 reshape): adds `logoUrl: string | null` per subnet (§3.8). Browser reads must accept either v1 or v2 during the rollout window between schema-update commits and the first v2 snapshot landing on the `data` branch.

## 8. Stack

- **SvelteKit** with **`@sveltejs/adapter-static`** — fully static output. TypeScript. Vite.
- **Three.js** for the Stage 4 breathing field.
- **Cloudflare Pages** (free tier, static) for hosting; Cloudflare DNS for `metagraphs.live`.
- **GitHub Actions** — CI on push/PR; daily snapshot cron at 02:00 UTC.
- **Node `>=22`** (LTS). Pinned via `.nvmrc` and `engines`.
- **Continuity docs:** `SPEC.md` (this file), `DECISIONS.md`, `PROJECT-STATUS.md`, and the staged prompts under `docs/handoff/`.

## 9. Engineering constraints

- **Never put API keys in chat.** `TAOSTATS_API_KEY` comes from `.env` locally and a repo secret in Actions.
- **Free-tier discipline.** Taostats free tier is 5 calls/min. The snapshot job must pace itself and fail soft.
- **Small commits, conventional messages.** `feat: …`, `fix: …`, `chore: …`, `docs: …`. One logical unit per commit.
- **Push to remote before declaring done.** A stage closes only when `git log origin/main --oneline -5` confirms the work is on the remote.
- **"Done" requires browser verification.** Tests passing + clean build is necessary, not sufficient.
- **Verify `.gitignore`.** Confirm no asset or shader directory is silently excluded before assuming it's committed.
- **Spec is the source of truth.** If the spec says one thing and your memory says another, trust the spec. If you think the spec is wrong, stop and surface it.
- **Data gaps are honest placeholders.** Missing or stale fields render as a labelled neutral state with an "as of" note. Never invent.

## 10. Stage plan

The build is sequenced as eight stages, each ending in a stop-and-confirm boundary. Stage prompts live in [`docs/handoff/`](docs/handoff/):

| Stage | File                        | Outcome                                                                                                              |
| ----- | --------------------------- | -------------------------------------------------------------------------------------------------------------------- |
| 1     | `01-bootstrap.md`           | Greenfield scaffold + canonical docs + holding page                                                                  |
| 2     | `02-data-pipeline.md`       | Taostats snapshot cron + `network.json` schema (per-Yuma-epoch, data branch + jsDelivr)                              |
| 3     | `03-scaffold.md`            | First real components + browser fetch of jsDelivr-served network.json + visual verification on staging — ✅ complete |
| 4     | `04-field.md`               | Hero field (Three.js, phyllotaxis, honesty colour, microscope zoom) — ✅ complete                                    |
| 5     | `05-heartbeat-lifecycle.md` | Yuma-epoch-locked heartbeat + births/deaths + signal refinement (honesty colour landed at Stage 4, see D11)          |
| 6     | `06-delegate-panel.md`      | Delegate-to-power-this (partner validator)                                                                           |
| 7     | `07-time-and-sound.md`      | Time-lapse default + scrubber + opt-in sonification                                                                  |
| 8     | `08-tests-signoff.md`       | Integration tests, browser verification, signoff                                                                     |
