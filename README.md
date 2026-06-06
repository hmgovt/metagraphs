# Metagraphs

A living visualisation of the Bittensor network — a field of ~128 subnets rendered as cells of an organism, pulsing on the Yuma Consensus epoch. Not a dashboard; a portrait.

Canonical domain: [metagraphs.live](https://metagraphs.live)

## Status

Stage 1 — greenfield bootstrap. The site currently serves a holding page only. See [`docs/handoff/`](docs/handoff/) for the staged implementation plan and [`SPEC.md`](SPEC.md) / [`DECISIONS.md`](DECISIONS.md) for the project's source of truth.

## Stack

- **SvelteKit** (TypeScript) with `@sveltejs/adapter-static` — fully static output.
- **Three.js** — wired as a dependency; first used in Stage 4 for the breathing field.
- **Vite** — dev server and build.
- **Cloudflare Pages** — static host, fronted by Cloudflare DNS.
- **GitHub Actions** — CI on push/PR and a daily snapshot cron (02:00 UTC) that writes `static/network.json` from the Taostats free-tier API.

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

No runtime env vars are required for the site itself — all rendering math is client-side from `static/network.json`. `TAOSTATS_API_KEY` is used only by the snapshot workflow in GitHub Actions.

## Environment

Copy `.env.example` to `.env` and fill in `TAOSTATS_API_KEY` for any local snapshot experimentation. The real key never leaves your machine or the repo's Actions secrets — never put it in chat, commits, or `.env.example`.

## Repository layout

```
src/                 SvelteKit app source
static/              Static assets served as-is (includes network.json once Stage 2 lands)
docs/handoff/        Staged implementation prompts (00-overview, 01-bootstrap, …)
SPEC.md              Canonical specification
DECISIONS.md         Locked design decisions, dated log
PROJECT-STATUS.md    Current stage + progress
.github/workflows/   CI build and daily snapshot cron
```

## Contributing

Small commits, conventional messages (`feat:`, `fix:`, `chore:`, `docs:`). One logical unit per commit. A stage closes only when work is pushed to `origin/main` and the build is verified in a browser at real data.
