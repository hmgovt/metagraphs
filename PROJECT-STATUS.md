# Project status

_Snapshot of where Metagraphs is right now. Update at the end of every stage and whenever a stage prompt is amended. Source of truth for spec is [`SPEC.md`](SPEC.md); for decisions, [`DECISIONS.md`](DECISIONS.md); for stage prompts, [`docs/handoff/`](docs/handoff/)._

Last updated: 2026-06-06.

---

## Current phase

**Stage 1 — Greenfield bootstrap.** ✅ Complete and deployed. Holding page live on Cloudflare Pages.

**Stage 2 — Data pipeline.** Prompt authored in [`docs/handoff/02-data-pipeline.md`](docs/handoff/02-data-pipeline.md); not yet executed.

## What is in place (Stage 1)

- Repo skeleton: SvelteKit + TypeScript + Vite + `@sveltejs/adapter-static`. Pushed to `origin/main`.
- Three.js + `@types/three` installed as deps, **not yet used** (first used in Stage 4).
- Node pinned to `>=22` via `.nvmrc` and `engines`.
- ESLint + Prettier configured.
- Canonical docs authored: `SPEC.md`, `DECISIONS.md`, this file.
- Staged prompts: `00-overview`, `01-bootstrap`, and the freshly-authored `02-data-pipeline` under `docs/handoff/`.
- Dark holding page at `/` — wordmark, descriptor, "as of —" stamp, warm CSS-only radial pulse. No data, no Three.js, no node-link imagery.
- CI workflow: install + typecheck + lint + build on push/PR.
- Daily snapshot workflow stubbed at 02:00 UTC — references `TAOSTATS_API_KEY` secret, echoes a Stage 2 TODO. **Replaced in Stage 2.**
- `.env.example` committed; real `.env` gitignored.
- Cloudflare Pages connected, **Framework preset = None**, building from `main`, serving the holding page.

## What Stage 2 will change

- Replaces the stub `snapshot.yml` with a real fetcher at **per-Yuma-epoch cadence** (D8 — ~72 min, ~20/day, GHA `*/10 * * * *` with epoch dedup).
- Adds Taostats REST fetchers + a `@polkadot/api` Subtensor fallback (D10).
- Writes `data/network.ndjson` (history) and `static/network.json` (latest pivoted state), validated against `static/network.schema.json`.
- Commits snapshots to a separate **`data` branch** (D9). CF Pages stays on `main` only.
- Browser will fetch `network.json` from **jsDelivr** (`https://cdn.jsdelivr.net/gh/hmgovt/metagraphs@data/static/network.json`) — URL constant lands in Stage 2, browser wiring lands in Stage 4.
- Pins the real-revenue signal heuristic formula in `SPEC.md §3.3` before any code that computes it.

## What is not yet done

- Everything in Stages 2–8 — no data pipeline yet, no field, no heartbeat, no delegate panel, no time/sound, no tests.

## Stage index

| Stage | File                                                                   | Status                                                                                                                                                               |
| ----- | ---------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1     | [`docs/handoff/01-bootstrap.md`](docs/handoff/01-bootstrap.md)         | ✅ Complete                                                                                                                                                          |
| 2     | [`docs/handoff/02-data-pipeline.md`](docs/handoff/02-data-pipeline.md) | Prompt authored; not yet executed                                                                                                                                    |
| 3     | `docs/handoff/03-scaffold.md`                                          | Not started — prompt not yet authored; **overlaps with Stage 1 (greenfield rename swallowed some of Stage 3's scope). Reconcile when authoring the Stage 3 prompt.** |
| 4     | `docs/handoff/04-field.md`                                             | Not started — prompt not yet authored                                                                                                                                |
| 5     | `docs/handoff/05-heartbeat-lifecycle.md`                               | Not started — prompt not yet authored                                                                                                                                |
| 6     | `docs/handoff/06-delegate-panel.md`                                    | Not started — prompt not yet authored                                                                                                                                |
| 7     | `docs/handoff/07-time-and-sound.md`                                    | Not started — prompt not yet authored                                                                                                                                |
| 8     | `docs/handoff/08-tests-signoff.md`                                     | Not started — prompt not yet authored                                                                                                                                |

## Open notes / things to surface next session

- **Before running Stage 2:** verify the Taostats free-tier daily call cap (per-minute is 5; daily may be capped separately). Stage 2 Step 0 already calls this out.
- **Cloudflare Pages branch settings.** Before the Stage 2 workflow commits to the `data` branch, confirm in the Pages dashboard that `data` is excluded from preview deployments — otherwise every snapshot triggers a preview build and the quota argument behind D9 evaporates.
- **Stage 3 scope overlap.** The original Stage 1 was a spec-sync read of existing code; the greenfield rename to "bootstrap" pulled in SvelteKit scaffold and Cloudflare-target work that Stage 3 also lists. When the Stage 3 prompt is authored, decide whether it becomes a "first real components + visual verification on staging" stage or is collapsed entirely.
- **BWI patterns referenced** by D2, D5, D7 live in `hmgovt/bitcoinweighin` (local checkout at `~/Projects/bitcoinweighin`). The Stage 2 prompt already points at BWI's `scripts/{fetch-daily,build-prices-json,sources,fetchers}.ts` as the pipeline template; future stages should keep doing this for the visualisation patterns.
- **Defensive domains** (`metagraphs.app`, `metagraphs.io`, singular `metagraph.live`) need to be registered and redirected to `.live`. Human action, not in any stage prompt — track separately.
