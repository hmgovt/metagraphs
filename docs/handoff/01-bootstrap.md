# Stage 1 — Greenfield Bootstrap

_Read `00-OVERVIEW.md` first, then this. Run this stage on **Claude Opus 4.8**. Stop-and-confirm at the Stage 1 boundary — do not start Stage 2._

## What this stage is

Greenfield bootstrap of the Metagraphs repo. There is **no existing code to sync** — the GitHub repo (`hmgovt/metagraphs`) exists but is empty. This stage stands up the skeleton, proves the deploy path end-to-end, and authors the canonical project docs. It builds **none** of the visualisation.

## Step 0 — Comprehension (before writing any code)

Read `00-OVERVIEW.md` in full. Summarise back, in your own words: the concept, the seven locked decisions, the hard aesthetic rule (Decision 2), and what is explicitly out of v1 scope. List anything ambiguous or anything you'd push back on. If nothing is blocking, proceed through the steps below, committing in small logical units. The human is reviewing — surface concerns, don't silently amend.

## Step 1 — Repo + toolchain

- Initialise git locally and set the remote to `hmgovt/metagraphs` (`git@github.com:hmgovt/metagraphs.git` or the HTTPS equivalent — the repo exists and is empty).
- Scaffold **SvelteKit** (current version) with **TypeScript** and **Vite**.
- Use **`@sveltejs/adapter-static`** for a fully static build targeting **Cloudflare Pages**. Configure prerendering; add an SPA fallback only if a route genuinely needs it.
- Add **Three.js** as a dependency. Do not use it this stage.
- Pin the Node version (`.nvmrc` and `engines` in `package.json`).

## Step 2 — Cloudflare Pages target

- Ensure the `adapter-static` output directory and config are correct for Cloudflare Pages' Git integration. The human will connect the repo to a Pages project; your job is to make the build "just work" when they do.
- Document the build command (`npm run build`) and the output directory in the `README.md`.

## Step 3 — Docs scaffold + canonical docs

- Create `docs/handoff/` and move `00-OVERVIEW.md` and this `01-bootstrap.md` into it.
- In `00-OVERVIEW.md`, correct the stage-index list: rename `01-spec-sync.md` → `01-bootstrap.md` to match this greenfield rename.
- Author **`SPEC.md`** at the repo root: translate the concept, the seven locked decisions, the data architecture, and the stack from the overview into a proper specification. This becomes the source of truth from here on.
- Author **`DECISIONS.md`**: one dated entry (`2026-06-04`) per locked decision, in a terse log style.
- Stub **`PROJECT-STATUS.md`**: current phase = "Stage 1 bootstrap".

## Step 4 — Env + secrets hygiene

- `.gitignore` must cover `node_modules`, `.env`, the build output dir, and OS cruft.
- Commit `.env.example` containing `TAOSTATS_API_KEY=` (empty). The real key lives in local `.env` (gitignored) and in the repo's Actions secrets (already configured).
- Never print, echo, or commit the key.

## Step 5 — Holding page (prove the toolchain)

A single dark holding route, existing only to prove build + deploy: the word **Metagraphs**, a one-line descriptor, and an "as of —" placeholder stamp. Deep near-black, physiological and on-brand; a single faint pulse is fine if trivially cheap. **No data, no Three.js field, and emphatically not a node-link graph.** It must not look like the default SvelteKit splash, and it must not look like a crypto network diagram (see Decision 2). Tasteful emptiness.

## Step 6 — CI + snapshot stub

- A CI GitHub Actions workflow: install + typecheck + build on push/PR.
- A **second** workflow for the daily snapshot, scheduled `02:00 UTC`, but **stubbed**: checkout, set up Node, reference the `TAOSTATS_API_KEY` secret, and `echo` a TODO pointing to Stage 2. Do **not** implement the Taostats pull or write `network.json` — that is Stage 2. The cron and secret wiring may be in place; the logic is not.

## Step 7 — Commit, push, report, stop

- Small logical commits, conventional messages.
- Push to `origin/main`; confirm with `git log origin/main --oneline -5`.
- Report: the tree created, the build command + output dir, what the holding page shows, and the exact next human step — **connect the repo to a Cloudflare Pages project to get the `.pages.dev` staging URL**. Then **STOP**. Do not begin Stage 2.

## Out of scope for this stage (do not build)

- The Three.js breathing field (Stage 4)
- The Taostats pull / `network.json` (Stage 2)
- Subnet cells, the heartbeat, lifecycle births/deaths, honesty colouring (Stages 4–5)
- The delegate panel (Stage 6)
- Time-lapse, scrubber, sonification (Stage 7)

If you feel pulled to build any of these to "make it look like something," stop — the holding page is deliberately empty.

## Constraints

- Keys never in chat or commits.
- "Done" = pushed to `origin/main` **and** the holding page verified rendering in a local browser (`npm run build` + preview), not just a clean typecheck.
- Verify `.gitignore` is neither committing `.env` nor silently excluding anything that should be tracked.
