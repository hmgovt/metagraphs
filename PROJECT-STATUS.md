# Project status

_Snapshot of where Metagraphs is right now. Update at the end of every stage and whenever a stage prompt is amended. Source of truth for spec is [`SPEC.md`](SPEC.md); for decisions, [`DECISIONS.md`](DECISIONS.md); for stage prompts, [`docs/handoff/`](docs/handoff/)._

Last updated: 2026-06-06.

---

## Current phase

**Stage 1 — Greenfield bootstrap.** ✅ Complete and deployed.

**Stage 2 — Data pipeline.** ✅ Complete. First snapshot verified live on the `data` branch and reachable through jsDelivr — epoch 23190, block 8348673, source taostats, 129 subnets, schema-valid. emissionShare concentration matches SPEC §2 (top ~30 carrying ~1.0 of the share, long cold tail at zero). First-snapshot quirk noted: most signals tagged `computed:v1-low-confidence` because `historicalEmissionShare` defaults to the current value when NDJSON has no prior row; rows transition to `computed:v1` as history accumulates.

**Stage 3 — Scaffold.** Prompt authored in [`docs/handoff/03-scaffold.md`](docs/handoff/03-scaffold.md); not yet executed. Re-scoped to "first real components + live data wiring + visual verification on staging" since Stage 1 already shipped the SvelteKit / Cloudflare scaffold the original Stage 3 listed. No Three.js field yet — that lands in Stage 4.

## What is in place (Stage 2)

- **Schema pinned** in [`SPEC.md` §7.4](SPEC.md#74-snapshot-schema) and machine-validated against [`static/network.schema.json`](static/network.schema.json) (JSON Schema draft 2020-12).
- **Real-revenue v1 formula pinned** in [`SPEC.md` §3.3.1](SPEC.md#331-real-revenue-signal--v1-formula); implemented in [`scripts/signal.ts`](scripts/signal.ts) with the cumulativeEmissionApprox=0, marketCap=null, and historicalEmissionShare=0 edge cases handled.
- **Snapshot pipeline** under `scripts/` (TypeScript, run via `tsx`):
  - `sources.ts` — Taostats endpoint config + Subtensor RPC URL + formula constants.
  - `fetchers-taostats.ts` — paced (12 s + jitter) REST fetcher with 429/5xx retry, URL + header redaction, defensive field-alias mapping.
  - `fetchers-subtensor.ts` — `@polkadot/api` fallback against `wss://entrypoint-finney.opentensor.ai:443`; per-field tryRead so a runtime-storage mismatch falls through to null and forward-fill.
  - `fetch-snapshot.ts` — orchestrator: chain-head read, epoch dedup, Taostats primary, Subtensor fallback, per-field forward-fill, §3.3.1 Tier C signal, NDJSON append, meta write, `reserveStale` path when both sources fail.
  - `build-network-json.ts` — pivots the last NDJSON row into `static/network.json`, derives registration/deregistration events by diff against second-to-last row, gzip size canary at 500 KB.
  - `validate-snapshot.ts` — ajv validation against `network.schema.json`; non-zero exit fails the workflow.
- **`npm run snapshot[:fetch|:build|:validate]` scripts** in `package.json`.
- **Workflow `.github/workflows/snapshot.yml`** — cron `*/10 * * * *` + `workflow_dispatch`. Checks out `main`, switches to (or creates) the `data` branch, syncs the schema from main, runs the pipeline, commits `chore(snap): epoch N at YYYY-MM-DDTHH:MMZ (block B)` to `data` only when files actually changed.
- **Browser URL constants** in [`src/lib/data-source.ts`](src/lib/data-source.ts) pointing at jsDelivr's `@data` ref. Unused by app code until Stage 4.
- **README** documents the local `npm run snapshot` flow and the data-branch / jsDelivr architecture.
- **DECISIONS** D8 (per-epoch cadence), D9 (two-branch + jsDelivr), D10 (`@polkadot/api` Subtensor fallback) logged on 2026-06-06.

## What Stage 2 deliberately leaves for later

- The breathing field, cell rendering, Three.js (Stage 4).
- Wiring the §3.3.1 signal to actual cell colour (Stage 5 — Stage 2 only defines the signal and computes the number).
- Time-lapse / scrubber (Stage 7 — Stage 2 only writes the NDJSON history; rendering it is later).
- Cloudflare R2 migration of the JSON delivery (deferred to Stage 7+ hardening if jsDelivr ever proves insufficient).
- Per-subnet weight matrices `subnet.W` (Phase 2, never in v1).

## Stage index

| Stage | File                                                                   | Status                                                |
| ----- | ---------------------------------------------------------------------- | ----------------------------------------------------- |
| 1     | [`docs/handoff/01-bootstrap.md`](docs/handoff/01-bootstrap.md)         | ✅ Complete                                           |
| 2     | [`docs/handoff/02-data-pipeline.md`](docs/handoff/02-data-pipeline.md) | ✅ Complete; verified live on jsDelivr at epoch 23190 |
| 3     | [`docs/handoff/03-scaffold.md`](docs/handoff/03-scaffold.md)           | Prompt authored; not yet executed                     |
| 4     | `docs/handoff/04-field.md`                                             | Not started — prompt not yet authored                 |
| 5     | `docs/handoff/05-heartbeat-lifecycle.md`                               | Not started — prompt not yet authored                 |
| 6     | `docs/handoff/06-delegate-panel.md`                                    | Not started — prompt not yet authored                 |
| 7     | `docs/handoff/07-time-and-sound.md`                                    | Not started — prompt not yet authored                 |
| 8     | `docs/handoff/08-tests-signoff.md`                                     | Not started — prompt not yet authored                 |

## Open notes / things to surface next session

- **Cloudflare Pages branch settings (human, confirm once).** In the Pages dashboard, confirm the `data` branch is excluded from preview deployments — otherwise the per-epoch cron triggers a preview build every 10 min and the quota argument behind D9 evaporates. Production branch stays `main`. Until this is confirmed, watch CF Pages build counts.
- **First-snapshot signal quirk.** On a fresh NDJSON, `historicalEmissionShare` falls back to current `emissionShare`, so subnets currently earning zero land in the `computed:v1-low-confidence` path (`cumulativeEmissionApprox == 0` → `(P+V)/2`). As history accumulates and the running mean reflects multi-epoch behaviour, more subnets will move onto `computed:v1`. This is the formula behaving as specified in §3.3.1, not a bug — but worth re-checking the distribution after ~24 hours of snapshots before Stage 4 wires colour to the signal.
- **Taostats auth scheme.** Taostats's public docs gate the auth-scheme reference page behind login. The fetcher codes the convention `Authorization: <key>` (no Bearer prefix); if the live API rejects this, the one-line fix is `authHeaders()` in [`scripts/fetchers-taostats.ts`](scripts/fetchers-taostats.ts). Surfacing here so the failure mode has a fast remedy.
- **Subtensor storage names.** The fallback queries `subtensorModule.subnetAlphaIn`, `subnetTAO`, `emissionValues`, `networkRegisteredAt`, etc. These match the dTAO refactor's runtime as of writing; per-field `tryRead` swallows mismatches and forward-fill picks them up. If a future runtime rename causes the fallback to produce mostly-null rows, the storage names in [`scripts/fetchers-subtensor.ts`](scripts/fetchers-subtensor.ts) need an update.
- **Schema sync.** `static/network.schema.json` lives on `main` and is mirrored onto `data` by the workflow each run. If you change it on `main`, the next snapshot will pick up the new version on `data` automatically — no manual sync needed.
- **BWI patterns referenced** by D2, D5, D7 live in `hmgovt/bitcoinweighin` (local checkout at `~/Projects/bitcoinweighin`). The Stage 2 pipeline mirrored the `scripts/{fetch-daily,build-prices-json,sources,fetchers}.ts` shape — future visualisation stages should keep referencing BWI patterns.
- **Defensive domains** (`metagraphs.app`, `metagraphs.io`, singular `metagraph.live`) still need to be registered and redirected to `.live`. Human action, not in any stage prompt — track separately.
