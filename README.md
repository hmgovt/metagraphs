# Metagraphs

A living visualisation of the Bittensor network — a field of ~128 subnets rendered as cells of an organism, pulsing on the Yuma Consensus epoch. Not a dashboard; a portrait.

Canonical domain: [metagraphs.live](https://metagraphs.live)

## Status

Stage 2 — data pipeline. Snapshots commit per-Yuma-epoch to the `data` branch; CF Pages stays on `main`. The site itself still serves the Stage 1 holding page until Stage 4 lands the breathing field. See [`docs/handoff/`](docs/handoff/) for the staged implementation plan and [`SPEC.md`](SPEC.md) / [`DECISIONS.md`](DECISIONS.md) for the project's source of truth.

## Stack

- **SvelteKit** (TypeScript) with `@sveltejs/adapter-static` — fully static output.
- **Three.js** — wired as a dependency; first used in Stage 4 for the breathing field.
- **Vite** — dev server and build.
- **Cloudflare Pages** — static host, fronted by Cloudflare DNS. Watches `main` only.
- **GitHub Actions** — CI on push/PR (`ci.yml`) and a per-epoch snapshot cron (`snapshot.yml`, `*/10 * * * *`) that writes to the `data` branch.
- **Taostats free-tier REST + `@polkadot/api` Subtensor fallback** — the snapshot pipeline. Aggregated subnet state per Yuma epoch (~72 min).

## Local development

Requires Node `>=22` (LTS). `.nvmrc` pins to 22 for nvm/fnm users.

```sh
npm install
npm run dev          # vite dev server with HMR
npm run check        # svelte-check (type + svelte diagnostics)
npm run lint         # prettier --check && eslint
npm run format       # prettier --write
```

## Building

```sh
npm run build        # outputs static site to ./build
npm run preview      # local preview of the production build
```

## Cloudflare Pages deployment

The Cloudflare Pages project is connected to this repo with:

- **Build command:** `npm run build`
- **Build output directory:** `build`
- **Node version:** `22`
- **Production branch:** `main` (snapshot commits land on `data`; Pages does not redeploy for those).

No runtime env vars are required for the site itself — all rendering math is client-side. `TAOSTATS_API_KEY` is used only by the snapshot workflow in GitHub Actions.

## Snapshot pipeline (Stage 2)

The snapshot is a per-Yuma-epoch (~72 min, ~20/day) capture of Bittensor subnet aggregates. Architecturally:

- **Primary source:** Taostats REST API (free tier, 5 calls/min — paced).
- **Fallback (D10):** `@polkadot/api` against `wss://entrypoint-finney.opentensor.ai:443`. JavaScript-only — no Python `btcli`.
- **Outputs (on the `data` branch):**
  - `data/network.ndjson` — append-only history, one snapshot per line.
  - `static/network.json` — latest snapshot, the shape the browser fetches.
  - `static/network.schema.json` — JSON Schema draft 2020-12 contract (mirrored from `main`).
  - `static/network-meta.json` — per-endpoint health, source, rolling "as of" window.
- **Delivery:** the browser will fetch from jsDelivr's GitHub CDN — `https://cdn.jsdelivr.net/gh/hmgovt/metagraphs@data/static/network.json`. URL constants are pinned in [`src/lib/data-source.ts`](src/lib/data-source.ts); the actual fetch lands in Stage 4 alongside the breathing field.
- **Schema is the contract:** see [`SPEC.md` §7.4](SPEC.md#74-snapshot-schema). Schema-invalid snapshots fail the workflow loudly and leave the previous snapshot in place.
- **Fail-soft (SPEC §7.1):** per-field forward-fill when a source misses a non-critical field; a `stale: true` re-write of the prior snapshot when both sources are down. Never crash, never fabricate.

### Local snapshot run

Requires `.env` with a real `TAOSTATS_API_KEY` (never commit it):

```sh
npm run snapshot         # fetch → build pivot → validate
# or, step by step:
npm run snapshot:fetch   # writes data/network.ndjson + static/network-meta.json
npm run snapshot:build   # pivots last NDJSON row into static/network.json
npm run snapshot:validate  # ajv against static/network.schema.json
```

The orchestrator deduplicates by Yuma epoch, so re-running inside the same epoch is a clean no-op.

## Environment

Copy `.env.example` to `.env` and fill in `TAOSTATS_API_KEY` for any local snapshot experimentation. The real key never leaves your machine or the repo's Actions secrets — never put it in chat, commits, or `.env.example`.

## Repository layout

```
src/                 SvelteKit app source (Stage 4+ will read static/network.json via jsDelivr)
src/lib/data-source.ts  jsDelivr URL constants for the snapshot pipeline
scripts/             Stage 2 snapshot pipeline (TypeScript, run via tsx)
static/              Static assets served as-is
static/network.schema.json  Snapshot contract (JSON Schema draft 2020-12)
data/                Snapshot history (NDJSON). Only populated on the `data` branch.
docs/handoff/        Staged implementation prompts (00-overview, 01-bootstrap, …)
SPEC.md              Canonical specification
DECISIONS.md         Locked design decisions, dated log
PROJECT-STATUS.md    Current stage + progress
.github/workflows/   ci.yml (typecheck/lint/build) + snapshot.yml (per-epoch cron)
```

## Branches

- `main` — site code. Cloudflare Pages watches this branch.
- `data` — snapshot data. Updated by the `snapshot.yml` workflow only. Never merged into `main`.

## Contributing

Small commits, conventional messages (`feat:`, `fix:`, `chore:`, `docs:`). One logical unit per commit. A stage closes only when work is pushed to `origin/main` and the build is verified in a browser at real data.
