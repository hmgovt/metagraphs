# Project status

_Snapshot of where Metagraphs is right now. Update at the end of every stage and whenever a stage prompt is amended. Source of truth for spec is [`SPEC.md`](SPEC.md); for decisions, [`DECISIONS.md`](DECISIONS.md); for stage prompts, [`docs/handoff/`](docs/handoff/)._

Last updated: 2026-06-06.

---

## Current phase

**Stage 1 — Greenfield bootstrap.** ✅ Complete and deployed.

**Stage 2 — Data pipeline.** ✅ Code complete. Pending Stage 2 final act: human-triggered `workflow_dispatch` of `snapshot.yml` and `curl` of the jsDelivr URL confirming valid JSON within ~10 min of push.

**Stage 3 — Scaffold.** Not yet started. The Stage 1 greenfield rename already landed the SvelteKit scaffold and Cloudflare-target work that the original Stage 3 prompt listed, so Stage 3 will be re-scoped to "first real components + visual verification on staging" when its prompt is authored. The overlap note from the previous status is closed.

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

| Stage | File                                                                   | Status                                                                                                                                                |
| ----- | ---------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1     | [`docs/handoff/01-bootstrap.md`](docs/handoff/01-bootstrap.md)         | ✅ Complete                                                                                                                                           |
| 2     | [`docs/handoff/02-data-pipeline.md`](docs/handoff/02-data-pipeline.md) | ✅ Code complete; awaiting first workflow_dispatch + jsDelivr verification                                                                            |
| 3     | `docs/handoff/03-scaffold.md`                                          | Not started — prompt to be authored. Re-scope to "first real components + visual verification on staging" given Stage 1 already shipped the scaffold. |
| 4     | `docs/handoff/04-field.md`                                             | Not started — prompt not yet authored                                                                                                                 |
| 5     | `docs/handoff/05-heartbeat-lifecycle.md`                               | Not started — prompt not yet authored                                                                                                                 |
| 6     | `docs/handoff/06-delegate-panel.md`                                    | Not started — prompt not yet authored                                                                                                                 |
| 7     | `docs/handoff/07-time-and-sound.md`                                    | Not started — prompt not yet authored                                                                                                                 |
| 8     | `docs/handoff/08-tests-signoff.md`                                     | Not started — prompt not yet authored                                                                                                                 |

## Open notes / things to surface next session

- **Stage 2 final act (human).** From the GitHub Actions UI, run `Snapshot` → `Run workflow` on `main`. Confirm: the workflow creates the `data` branch, the snapshot commit lands as `chore(snap): epoch …`, and `curl https://cdn.jsdelivr.net/gh/hmgovt/metagraphs@data/static/network.json` returns valid JSON within ~10 min (jsDelivr's purge interval). Until that's confirmed, Stage 2 is not closed.
- **Cloudflare Pages branch settings (human).** In the Pages dashboard, confirm the `data` branch is excluded from preview deployments — otherwise the per-epoch cron triggers a preview build every 10 min and the quota argument behind D9 evaporates. Production branch stays `main`.
- **Taostats auth scheme.** Taostats's public docs gate the auth-scheme reference page behind login. The fetcher codes the convention `Authorization: <key>` (no Bearer prefix); if the live API rejects this, the one-line fix is `authHeaders()` in [`scripts/fetchers-taostats.ts`](scripts/fetchers-taostats.ts). Surfacing here so the failure mode has a fast remedy.
- **Subtensor storage names.** The fallback queries `subtensorModule.subnetAlphaIn`, `subnetTAO`, `emissionValues`, `networkRegisteredAt`, etc. These match the dTAO refactor's runtime as of writing; per-field `tryRead` swallows mismatches and forward-fill picks them up. If a future runtime rename causes the fallback to produce mostly-null rows, the storage names in [`scripts/fetchers-subtensor.ts`](scripts/fetchers-subtensor.ts) need an update.
- **Schema sync.** `static/network.schema.json` lives on `main` and is mirrored onto `data` by the workflow each run. If you change it on `main`, the next snapshot will pick up the new version on `data` automatically — no manual sync needed.
- **BWI patterns referenced** by D2, D5, D7 live in `hmgovt/bitcoinweighin` (local checkout at `~/Projects/bitcoinweighin`). The Stage 2 pipeline mirrored the `scripts/{fetch-daily,build-prices-json,sources,fetchers}.ts` shape — future visualisation stages should keep referencing BWI patterns.
- **Defensive domains** (`metagraphs.app`, `metagraphs.io`, singular `metagraph.live`) still need to be registered and redirected to `.live`. Human action, not in any stage prompt — track separately.
