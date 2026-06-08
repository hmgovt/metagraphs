# Project status

_Snapshot of where Metagraphs is right now. Update at the end of every stage and whenever a stage prompt is amended. Source of truth for spec is [`SPEC.md`](SPEC.md); for decisions, [`DECISIONS.md`](DECISIONS.md); for stage prompts, [`docs/handoff/`](docs/handoff/)._

Last updated: 2026-06-08.

---

## Current phase

**Stage 1 — Greenfield bootstrap.** ✅ Complete and deployed.

**Stage 2 — Data pipeline.** ✅ Complete. First snapshot verified live on the `data` branch and reachable through jsDelivr — epoch 23190, block 8348673, source taostats, 129 subnets, schema-valid. emissionShare concentration matches SPEC §2 (top ~30 carrying ~1.0 of the share, long cold tail at zero). First-snapshot quirk noted: most signals tagged `computed:v1-low-confidence` because `historicalEmissionShare` defaults to the current value when NDJSON has no prior row; rows transition to `computed:v1` as history accumulates.

**Stage 3 — Scaffold.** ✅ Complete and deployed. The browser fetches the live snapshot from jsDelivr on first paint and refreshes every 5 minutes; the honest telemetry strip per [SPEC §3.6](SPEC.md#36-honest-telemetry-strip) renders `as of YYYY-MM-DD HH:MM UTC · epoch N · M subnets · source X` with the four states (fresh / stale / loading / unreachable) all visually confirmed.

**Stage 4 — The breathing field.** ✅ Complete and deployed (reshape pass landed 2026-06-07; snapshot schema v2 + logos landed 2026-06-08). The first cut shipped a small constellation of warm-amber dots that conveyed no semantic structure; product review forced the corrections logged as **D11 (honesty colour wired at Stage 4)**, **D12 (microscope zoom in scope; pan/orbit are not)**, **D13 (field renders as the hero, not framed by chrome)**, and **D14 (owner-declared logos plumbed through schema v2)**. The current Stage 4 deploys all four:

- Field fills the full viewport via `position: absolute; inset: 0` on `<main>`; header and telemetry overlay it as small floating dim blocks with subtle gradient backings for legibility.
- Two-channel shader fully wired — `aIntensity` from `emissionShare`, `aTemperature` from `realRevenueSignal` per cell via `temperatureFor(subnet)`. The 98-cell cold tail reads as teal at first paint; the 31 active subnets render along the cold↔warm axis. Honesty axis arrives on day one, not Stage 5.
- Microscope zoom: wheel + trackpad pinch (cursor-centred), double-click to tween toward a cell, Esc / `0` resets. Bounded `[1, 5.5]`; camera position clamped so the organism never leaves the viewport. No drag-to-pan.
- Cell name labels fade in past `NAME_LABEL_ZOOM_THRESHOLD = 2.4` for cells with `emissionShare > 0` — DOM elements positioned by frame-by-frame projection. ~30 labels at full zoom; the cold tail stays anonymous.
- **Owner-declared subnet logos** (snapshot schema v2 per D14, SPEC §3.8) render as 14 px circular crops next to the cell name. URLs come from Taostats's `/api/subnet/identity/v1` bulk endpoint (one extra paced call per snapshot, ~95/129 subnets currently carry one). `referrerpolicy="no-referrer"` + `loading="lazy"` + `<img onerror>` silent fallback. Broken URLs (one subnet literally points at `https://deprecated.png`) travel honestly through the snapshot — never policed.

Calibration constants for Stage 5 to inherit (in `src/lib/field/config.ts`): `R_MIN = 0.030`, `R_MAX = 0.115`, `EMISSION_REF = 0.12`, `INTENSITY_BASELINE = 0.85`, `INTENSITY_EXTRA = 0.7`, `MIN_ZOOM = 1`, `MAX_ZOOM = 5.5`, `NAME_LABEL_ZOOM_THRESHOLD = 2.4`. Verified on the live snapshot (epoch 23198) at desktop (1440×900) and mobile (390×844) viewports; zoom + label fade-in verified by temp-config screenshot. Reduced motion zeroes the breathe amplitude.

## What is in place (Stage 4)

- **Phyllotaxis layout** in [`src/lib/field/positions.ts`](src/lib/field/positions.ts) — pure function `uid → (x, y)`. Subnet 0 dead centre; new high-uid subnets at the rim. `MAX_SUBNETS = 256` from day one so the future cap expansion does not scramble positions.
- **Two-channel shader** in [`src/lib/field/shaders.ts`](src/lib/field/shaders.ts) — vertex (billboard + per-uid breathe phase) + fragment (Gaussian core + halo + 3-stop cold↔mid↔warm gradient, additive blending). Built so Stage 5 wires `aTemperature` from `realRevenueSignal` without re-architecting.
- **Three.js mount** in [`src/lib/field/Field.svelte`](src/lib/field/Field.svelte) — dynamic-imported (`await import('three')` inside `$effect`) so SSR-prerendered HTML is canvas-free. One `InstancedBufferGeometry`, one draw call per frame. `ResizeObserver` keeps the orthographic camera matched to canvas aspect. Raycast is done in 2D field space (cheaper than `THREE.Raycaster` for a flat field) with a 1.4× hit-radius multiplier and a 0.025 floor for ergonomic clicks on small cells.
- **Click tooltip** in [`src/lib/field/SubnetTooltip.svelte`](src/lib/field/SubnetTooltip.svelte) — DOM overlay (not in-canvas) anchored to projected cell screen position. Two lines: `subnet {uid}{ · name}` and `detail coming soon · phase 2`. Dismisses on outside-click, Esc, scroll, resize. No emission share, no validator count — D1 + D6 hold the line.
- **Page wiring** in [`src/routes/+page.svelte`](src/routes/+page.svelte) — Field mounted into `<main>`. `data-loaded` class drops the Stage 3 pulse to 50% opacity once snapshot data arrives, with a 600 ms ease-out transition. During loading / unreachable, the pulse stays at full opacity — the warm radial breathing remains the only sign of life until cells can render.
- **Bundle hygiene** — `grep -r TAOSTATS_API_KEY build/` returns nothing. Three.js ships in a ~680 KB dynamic chunk that only loads when Field mounts; the initial page payload stays small. Page-chunk fetched URLs are still only the two jsDelivr constants.
- **Calibration verified visually** at desktop (1440×900) and mobile (390×844, 2× DPI) viewports. The mobile portrait viewport renders the field most striking — the circular field naturally fills a tall narrow canvas. Top 5 emission cells (uids 95, 9, 84, 97, 107) are visibly larger, brighter, and warmer than the 98-subnet teal cold tail; the honesty axis is the first thing the viewer sees.
- **DECISIONS** D11 (honesty colour at Stage 4), D12 (microscope zoom is portraiture; pan/orbit are not), D13 (field is the hero, not framed by chrome) logged on 2026-06-07.

## What is in place (Stage 3)

- **Browser-facing types** in [`src/lib/types/network.ts`](src/lib/types/network.ts) — `SubnetRow`, `LifecycleEvent`, `NetworkEvents`, `NetworkJson`, `EndpointStatus`, `NetworkMeta`. Mirrored from `scripts/snapshot-types.ts` rather than re-exported, so the browser bundle does not pull in the Node-side pipeline. Schema in [`static/network.schema.json`](static/network.schema.json) is still the contract.
- **Network state store** at [`src/lib/state/network.svelte.ts`](src/lib/state/network.svelte.ts) — Svelte 5 runes, single source of truth. `data` / `meta` / `loading` / `error` / `lastFetchedAt`, plus a `refresh()` function. Browser-only (SSR is a no-op early-return); the first `refresh()` call lazily installs the 5-minute interval. `schemaVersion !== 1` is captured as an error.
- **Components** in [`src/lib/components/`](src/lib/components/):
  - `SiteHeader.svelte` — wordmark + descriptor hoisted into a header element, light visual weight, mobile-friendly.
  - `NetworkStatus.svelte` — the §3.6 honest-telemetry strip. Fresh / stale / loading / unreachable, no toast/spinner/icon. `asOf` formatted to minute precision (`YYYY-MM-DD HH:MM UTC`).
  - `SiteFooter.svelte` — attribution + cadence line + links to the `data` branch / SPEC / DECISIONS.
- **Page chassis** in [`src/routes/+page.svelte`](src/routes/+page.svelte) — header / main / footer grid; `<main>` deliberately empty; warm radial pulse hoisted to a sibling layer **behind** the field-mount region; mount-time `$effect` calls `refresh()` once.
- **Four telemetry states visually confirmed** via headless Chrome against a live build of the production output: fresh (`epoch 23190 · 129 subnets · source taostats`), stale (`stale ·` prefix renders with the rest of the line intact), loading (SSR-prerendered `as of —` baseline), unreachable (`as of — · data unreachable`). Stale + unreachable verifications used temporary `data-source.ts` edits which were reverted before commit.
- **No API keys in the build output** (`grep -r TAOSTATS_API_KEY build/` returns nothing). The only external URLs the page chunk fetches are the two jsDelivr `network.json` / `network-meta.json` constants in `src/lib/data-source.ts`.

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

| Stage | File                                                                   | Status                                                 |
| ----- | ---------------------------------------------------------------------- | ------------------------------------------------------ |
| 1     | [`docs/handoff/01-bootstrap.md`](docs/handoff/01-bootstrap.md)         | ✅ Complete                                            |
| 2     | [`docs/handoff/02-data-pipeline.md`](docs/handoff/02-data-pipeline.md) | ✅ Complete; verified live on jsDelivr at epoch 23190  |
| 3     | [`docs/handoff/03-scaffold.md`](docs/handoff/03-scaffold.md)           | ✅ Complete; live telemetry strip rendering on staging |
| 4     | [`docs/handoff/04-field.md`](docs/handoff/04-field.md)                 | ✅ Complete; live field rendering on staging           |
| 5     | `docs/handoff/05-heartbeat-lifecycle.md`                               | Not started — prompt not yet authored                  |
| 6     | `docs/handoff/06-delegate-panel.md`                                    | Not started — prompt not yet authored                  |
| 7     | `docs/handoff/07-time-and-sound.md`                                    | Not started — prompt not yet authored                  |
| 8     | `docs/handoff/08-tests-signoff.md`                                     | Not started — prompt not yet authored                  |

## Open notes / things to surface next session

- **Cloudflare Pages branch settings (human, confirm once).** In the Pages dashboard, confirm the `data` branch is excluded from preview deployments — otherwise the per-epoch cron triggers a preview build every 10 min and the quota argument behind D9 evaporates. Production branch stays `main`. Until this is confirmed, watch CF Pages build counts.
- **First-snapshot signal quirk.** On a fresh NDJSON, `historicalEmissionShare` falls back to current `emissionShare`, so subnets currently earning zero land in the `computed:v1-low-confidence` path (`cumulativeEmissionApprox == 0` → `(P+V)/2`). As history accumulates and the running mean reflects multi-epoch behaviour, more subnets will move onto `computed:v1`. This is the formula behaving as specified in §3.3.1, not a bug — but worth re-checking the distribution before Stage 5 wires colour to the signal (Stage 4 deliberately pins temperature to a single warm baseline, so this quirk does not affect the field render until Stage 5).
- **Taostats auth scheme.** Taostats's public docs gate the auth-scheme reference page behind login. The fetcher codes the convention `Authorization: <key>` (no Bearer prefix); if the live API rejects this, the one-line fix is `authHeaders()` in [`scripts/fetchers-taostats.ts`](scripts/fetchers-taostats.ts). Surfacing here so the failure mode has a fast remedy.
- **Subtensor storage names.** The fallback queries `subtensorModule.subnetAlphaIn`, `subnetTAO`, `emissionValues`, `networkRegisteredAt`, etc. These match the dTAO refactor's runtime as of writing; per-field `tryRead` swallows mismatches and forward-fill picks them up. If a future runtime rename causes the fallback to produce mostly-null rows, the storage names in [`scripts/fetchers-subtensor.ts`](scripts/fetchers-subtensor.ts) need an update.
- **Schema sync.** `static/network.schema.json` lives on `main` and is mirrored onto `data` by the workflow each run. If you change it on `main`, the next snapshot will pick up the new version on `data` automatically — no manual sync needed.
- **BWI patterns referenced** by D2, D5, D7 live in `hmgovt/bitcoinweighin` (local checkout at `~/Projects/bitcoinweighin`). The Stage 2 pipeline mirrored the `scripts/{fetch-daily,build-prices-json,sources,fetchers}.ts` shape — future visualisation stages should keep referencing BWI patterns.
- **Defensive domains** (`metagraphs.app`, `metagraphs.io`, singular `metagraph.live`) still need to be registered and redirected to `.live`. Human action, not in any stage prompt — track separately.
