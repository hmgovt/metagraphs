# Metagraphs — Marathon Session Overview

_Read this first at the start of every stage. Single source of truth for context. Last updated 4 June 2026._

**Project:** Metagraphs — a living visualisation of the Bittensor network.
**Domain:** `metagraphs.live` (canonical). Register `metagraphs.app`, `metagraphs.io`, and singular `metagraph.live` defensively and redirect to `.live`.

---

## Concept in one paragraph

Metagraphs renders the Bittensor network not as a dashboard but as a **living organism**. The macro view is a field of the network's ~128 subnets, each a glowing cell, fed by the emission heartbeat — the Yuma Consensus epoch — that pulses every ~72 minutes. Cells swell as they drink emissions, glow warm when they do real paid AI work and cold when they merely farm subsidy, and wink out when the market starves them and a new subnet ignites in the freed slot. It is grounded entirely in real on-chain data, honest about the ugly parts, and built to be left open all day and watched. We are the network's **portrait**, not its instrument.

---

## Working assumptions

- **Session date: 4 June 2026.** TAO ≈ $255 (volatile; every figure refreshes from the daily snapshot — never hard-code a price). All network facts below are pinned to behaviour, not price, so they hold as the snapshot moves.
- **The network, as of session date:** ~128 active subnets (hard cap; 256 expansion planned later 2026). 21M TAO hard cap, no pre-mine, no VC. First halving December 2025 cut emissions ~7,200 → ~3,600 TAO/day (~0.5 TAO/block; block ≈ 12 s).
- **The heartbeat is real, not a metaphor.** A Yuma Consensus epoch = 360 blocks ≈ 72 minutes ≈ 20 beats/day. On each beat, validator weight matrices resolve into miner/validator emissions. This pulse is the spine of the whole visualisation.
- **dTAO is live.** Each subnet has its own alpha token and AMM; staked TAO "votes" emissions toward subnets. The May 2026 refactor concentrated emissions on roughly the top ~30 subnets — visible in the field as a few bright cells and a long cold tail.
- **Validator economics:** a validator permit goes to the top 64 by stake per subnet; default validator take is 18%. Relevant only to the delegate panel (Decision 5), not the core render.

## What this session is for

A coordinated implementation push that compresses the design conversation into staged Code sessions. The stages are sequential, each ends with a stop-and-confirm boundary, and each stage prompt lives in its own file:

```
00-OVERVIEW.md              ← you are here
01-bootstrap.md             ← Stage 1: greenfield scaffold + canonical docs + holding page
02-data-pipeline.md         ← Stage 2: Taostats snapshot cron + network.json schema
03-scaffold.md              ← Stage 3: SvelteKit skeleton + Cloudflare deploy + components
04-field.md                 ← Stage 4: the breathing field of 128 (Three.js hero)
05-heartbeat-lifecycle.md   ← Stage 5: emission pulse + births/deaths + honesty colouring
06-delegate-panel.md        ← Stage 6: delegate-to-power-this (partner validator)
07-time-and-sound.md        ← Stage 7: time-lapse default + scrubber + opt-in sonification
08-tests-signoff.md         ← Stage 8: integration tests, browser verification, signoff
```

Don't try to ship multiple stages in one session. Stop at each boundary. The phase shape exists so the human reviewer can catch any misreading before it propagates. Each stage opens with a comprehension step: read and summarise the relevant files before writing a line of code.

---

## The locked decisions

These encode the design conversation. None are speculative. None are up for renegotiation inside the session. If any feels wrong as you implement, surface it — don't quietly amend.

### Decision 1 — Macro-first hero

v1 is the macro view only: the breathing field of ~128 subnets. The **micro view** — diving into a single subnet to render its Yuma weight matrix (validators judging miners, consensus forming, outliers clipped, emission flowing) — is the marquee Phase-2 feature and is **out of scope for v1**. Preserve the conceptual hook (a cell should be clickable as a no-op stub that reads "subnet detail coming soon") but build none of the matrix machinery yet. Macro reaches the broad audience that feeds the delegation funnel; micro is the depth we add once people are already inside.

### Decision 2 — Physiological, never a network-graph (hard aesthetic rule)

Every blockchain visualiser on earth is glowing blue dots connected by lines on black. **That look is failure.** If a screenshot reads as "crypto network graph," it is a bug. The register is _physiological_ — bioluminescent, neural, deep-ocean; something with a body temperature and a pulse, not a topology. Cell heat reuses the blackbody-glow approach from the BWI Pu-238 cube (separate intensity and colour-temperature channels). No node-link spaghetti. No force-directed hairball. A body, not a diagram.

### Decision 3 — Honest-data spine (the brand)

The data architecture mirrors BWI exactly. A daily GitHub Actions cron pulls a snapshot from the **Taostats free-tier API** (5 calls/min — pace the calls) into a static **`network.json`** that is this project's `prices.json`. All rendering math is client-side; no keys reach the browser. `bittensor` SDK / `btcli` metagraph reads against a public Subtensor endpoint are an acceptable free fallback (no key). A `/data` page with checksummed snapshots and a provenance/citation path is on the roadmap, not in v1.

**v1 snapshots subnet-level aggregates only** (emission share, alpha price, market cap, validator/miner counts, real-revenue signal where available, registration/deregistration events). Full per-subnet weight matrices (`subnet.W`) are heavy and belong to the Phase-2 micro dive — do not pull them at v1.

### Decision 4 — The honesty layer is mandatory, not decorative

We show what an insider dashboard won't. Emission-farming/subsidy cells render cold; subnets with real paid AI usage render warm — the colour code makes the parasites visible. Deregistrations are rendered as deaths; new registrations as ignitions. Owner-burn and the lopsided "one miner takes everything" distributions are surfaced, not hidden. Stealing TaoScope's bar: **a mismatch between what we render and chain state is a product bug, not an edge case.** Pretty earns its keep only by being true.

### Decision 5 — Delegate-to-power-this, baked in from v1

A "delegate to power this" panel ships in v1, wired to a **partner validator on a revenue-share** basis — the TAO-native equivalent of the BWI Lightning tip jar, but recurring yield rather than one-off sats. It must be architected to **repoint to our own validator hotkey later without a redesign** (the graduation path: partner now → own validator once delegation volume and ops justify it). The payoff mechanic: render **our own validator as a living cell inside the organism**, so a user can watch the stake they just delegated flow in on the next heartbeat. The tool that visualises the incentive network is itself a node in it.

No private keys, seed phrases, or signing flows are handled by us at v1 — delegation is initiated through the user's own wallet. We display and direct; we never custody.

### Decision 6 — Portrait, not explorer (positioning guardrail)

Taostats and TaoScope own the operator/analytics quadrant: fast tables for people debugging their own stake. **Do not compete there** — we lose on depth and speed and it isn't our game. We win on experience, emotion, and originality, which they explicitly disavow. Concretely: no metagraph tables, no validator leaderboards-as-tables, no "compare" grids in v1. The ambient, leave-it-open-and-watch-it-breathe quality is a feature, not an accident.

### Decision 7 — Time and sound

Default playback is a gentle **time-lapse of the most recent real beats**, looping, labelled as time-lapsed (honest). A **date/time scrubber** (the BWI date-scrubber muscle, reused) lets the viewer travel the network's life — dTAO launch, the December halving, the May refactor. **Sonification** — one soft sub-bass thud per epoch, each subnet humming a faint tone so the field is a slowly re-voicing chord — is opt-in and off by default, persisted via URL state, exactly as the Pu-238 Geiger crackle was. Scrubber and sound are the lightest-priority items in v1; if a stage runs long, they degrade to a follow-up before anything earlier is compromised.

---

## Things deliberately not in this session's scope

To prevent drift, these are explicitly out of v1:

- The micro view — single-subnet Yuma weight-matrix dive (Phase 2)
- Per-subnet full metagraph / `subnet.W` snapshots (Phase 2 data work)
- Running our own validator (graduation path; v1 is partner-validator only)
- Any key custody, signing, or transaction-submission flow
- `/data` page, checksums, provenance, Zenodo dataset path (roadmap)
- Subnet-sponsored / bespoke hero cells (a later revenue line)
- Newsletter capture, press kit, OG-image automation, video pipeline (later, as on BWI)
- 256-subnet expansion handling beyond keeping the cap a config value, not a magic number

If you find yourself wanting to touch any of the above to "complete" something, stop and surface it as a question instead.

---

## Stack

Unchanged from BWI: **SvelteKit + `@sveltejs/adapter-static`**, **Three.js**, TypeScript, Vite. **Cloudflare Pages** (free, static) + Cloudflare DNS. **GitHub Actions** daily cron at **02:00 UTC** for the snapshot. `docs/handoff/` plus `SPEC.md` / `DECISIONS.md` / `PROJECT-STATUS.md` for continuity.

---

## Constraints reminder

- **Never put API keys in chat.** `TAOSTATS_API_KEY` comes from `.env` locally and a repo secret in Actions. If you find yourself wanting to ask for a key value directly — that's a mistake, push back on the prompt instead.
- **Free-tier discipline.** Taostats free tier is 5 calls/min. The snapshot job must pace itself (sleep between calls) and fail soft — a missed snapshot reuses yesterday's `network.json` with a visible "as of" stamp, never a crash or a fabricated value.
- **Small commits, conventional messages.** `feat: add subnet cell heat channel`, `chore: pace taostats snapshot calls`, `docs: sync DECISIONS.md`.
- **One logical unit per commit.** Easier to revert, easier to read in `git log` later.
- **Push to remote before declaring done.** A stage closes only when `git log origin/main --oneline -5` confirms the work is on the remote. Local commits are not done.
- **"Done" requires browser verification.** Tests passing + clean build is necessary, not sufficient. The render must be confirmed in a browser at real snapshot data before a stage closes.
- **Verify gitignore.** Confirm no asset or shader directory is silently excluded before assuming it's committed.
- **Spec is the source of truth.** If the spec says one thing and your memory says another, trust the spec. If you genuinely think the spec is wrong, stop and surface it.
- **Data gaps are honest placeholders, never fabricated.** Missing or stale fields render as a labelled neutral state with an "as of" note. Never invent a number to fill a cell.

Now read the stage prompt for the current stage and proceed.
