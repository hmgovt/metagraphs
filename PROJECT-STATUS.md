# Project status

_Snapshot of where Metagraphs is right now. Update at the end of every stage and whenever a stage prompt is amended. Source of truth for spec is [`SPEC.md`](SPEC.md); for decisions, [`DECISIONS.md`](DECISIONS.md); for stage prompts, [`docs/handoff/`](docs/handoff/)._

Last updated: 2026-06-04.

---

## Current phase

**Stage 1 — Greenfield bootstrap.** In progress.

## What is in place

- Repo skeleton: SvelteKit + TypeScript + Vite + `@sveltejs/adapter-static`.
- Three.js installed as a dependency, **not yet used** (first used in Stage 4).
- Node pinned to `>=22` via `.nvmrc` and `engines`.
- ESLint + Prettier configured.
- Canonical docs authored: `SPEC.md`, `DECISIONS.md`, this file.
- Staged prompts moved into `docs/handoff/`.
- Dark holding page at `/` — wordmark, descriptor, "as of —" stamp, faint CSS-only radial pulse. No data, no Three.js, no node-link imagery.
- CI workflow: install + typecheck + build on push/PR.
- Daily snapshot workflow stubbed at 02:00 UTC — references `TAOSTATS_API_KEY` secret, echoes a Stage 2 TODO. **No Taostats logic yet.**
- `.env.example` committed; real `.env` gitignored.

## What is not yet done

- **Cloudflare Pages connection.** This is the next human step after Stage 1 — connect the GitHub repo to a Pages project to get the `*.pages.dev` staging URL. Build command: `npm run build`. Output directory: `build`. Node: 22.
- Everything in Stages 2–8. No data pipeline, no field, no heartbeat, no delegate panel, no time/sound, no tests.

## Stage index

| Stage | File                                                           | Status                                                                                                                                                               |
| ----- | -------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1     | [`docs/handoff/01-bootstrap.md`](docs/handoff/01-bootstrap.md) | In progress                                                                                                                                                          |
| 2     | `docs/handoff/02-data-pipeline.md`                             | Not started — prompt not yet authored                                                                                                                                |
| 3     | `docs/handoff/03-scaffold.md`                                  | Not started — prompt not yet authored; **overlaps with Stage 1 (greenfield rename swallowed some of Stage 3's scope). Reconcile when authoring the Stage 3 prompt.** |
| 4     | `docs/handoff/04-field.md`                                     | Not started — prompt not yet authored                                                                                                                                |
| 5     | `docs/handoff/05-heartbeat-lifecycle.md`                       | Not started — prompt not yet authored                                                                                                                                |
| 6     | `docs/handoff/06-delegate-panel.md`                            | Not started — prompt not yet authored                                                                                                                                |
| 7     | `docs/handoff/07-time-and-sound.md`                            | Not started — prompt not yet authored                                                                                                                                |
| 8     | `docs/handoff/08-tests-signoff.md`                             | Not started — prompt not yet authored                                                                                                                                |

## Open notes / things to surface next session

- **Stage 3 scope overlap.** The original Stage 1 was a spec-sync read of existing code; the greenfield rename to "bootstrap" pulled in SvelteKit scaffold and Cloudflare-target work that Stage 3 also lists. When the Stage 3 prompt is authored, decide whether it becomes a "first real components + visual verification on staging" stage or is collapsed entirely.
- **BWI patterns referenced** by D2, D5, D7 live in `hmgovt/bitcoinweighin` (local checkout at `~/Projects/bitcoinweighin`). Read that code first in Stages 4–7 rather than reconstructing patterns from first principles.
- **Defensive domains** (`metagraphs.app`, `metagraphs.io`, singular `metagraph.live`) need to be registered and redirected to `.live`. Human action, not in any stage prompt — track separately.
