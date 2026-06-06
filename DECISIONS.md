# Decisions

_A dated log of locked decisions. Newest at top. If a decision needs to change, append a new entry that supersedes the old one — do not silently rewrite._

---

## 2026-06-06 — Data pipeline architectural decisions (Stage 2 planning)

Captured during the Stage 2 planning conversation. These extend the D3 honest-data spine from the original kickoff with the cadence, delivery, and resilience choices forced by the move from daily → per-epoch snapshots.

### D8 — Snapshot cadence: one per Yuma epoch (~72 min)

The maximum useful snapshot frequency is one per Yuma Consensus epoch. The epoch is the unit at which validator weights resolve into emissions; sampling faster produces no new information and would violate D4 (a snapshot that shows movement when the chain hasn't is fabrication). Sampling slower (e.g. daily) wastes the live-pulse character of the visualisation. Implemented as a GitHub Actions cron at `*/10 * * * *` with epoch-deduplication in the orchestrator: the script reads the current chain epoch and exits 0 without writing if `data/network.ndjson`'s last line already has that epoch number. Catches every epoch within ~10 min of resolution; ~20 snapshots per day.

### D9 — Data delivery via two-branch split + jsDelivr

Snapshots commit to a separate `data` branch in the same repo, not to `main`. Cloudflare Pages watches only `main`, so the site does not redeploy on every snapshot (which would blow through CF Pages' 500-build/month free tier at ~20 deploys/day). The browser fetches `network.json` from jsDelivr's GitHub CDN: `https://cdn.jsdelivr.net/gh/hmgovt/metagraphs@data/static/network.json`. Zero new infra, zero recurring cost, off-brand fetch URL accepted as a v1 trade. Migration path to a Cloudflare R2 bucket at `data.metagraphs.live` is a Stage 7+ hardening task, undertaken if and only if jsDelivr proves insufficient (rate limits, cache staleness, branding).

### D10 — Subtensor fallback via `@polkadot/api` inside Stage 2

When Taostats is unavailable, the pipeline falls back to a `@polkadot/api` connection to a public Subtensor RPC endpoint (`wss://entrypoint-finney.opentensor.ai`) and queries the same fields directly from chain state. Implemented inside Stage 2, not deferred to a hardening stage — at per-epoch cadence (D8), even a short Taostats outage compounds into many consecutive stale snapshots, which undermines D4's honesty contract. `@polkadot/api` is chosen over Python `btcli` / the `bittensor` SDK to keep the CI toolchain JavaScript-only (one toolchain, no pip install in Actions). Cost: ~20 MB devdep, one new fetcher module, ~half a day of work inside Stage 2.

---

## 2026-06-04 — Locked decisions at project kickoff

Source: Metagraphs marathon-session overview (`docs/handoff/00-OVERVIEW.md`). Captured here in a terse log style, one per decision, in the order they were stated.

### D1 — Macro-first hero

v1 ships the macro view only: the breathing field of ~128 subnets. The **micro view** (single-subnet Yuma weight-matrix dive) is the marquee Phase-2 feature and is out of scope for v1. Preserve the conceptual hook (a cell is clickable as a no-op stub reading "subnet detail coming soon") but build no matrix machinery. Macro feeds the broad audience that feeds the delegation funnel; micro is the depth we add once people are inside.

### D2 — Physiological, never a network-graph (hard aesthetic rule)

Every blockchain visualiser is glowing blue dots on black with lines connecting them. That look is failure. If a screenshot reads as "crypto network graph," it is a bug. The register is _physiological_ — bioluminescent, neural, deep-ocean; a body with temperature and pulse, not a topology. Cell heat reuses the BWI Pu-238 blackbody-glow approach (separate intensity and colour-temperature channels). No node-link spaghetti. No force-directed hairball.

### D3 — Honest-data spine (the brand)

Data architecture mirrors BWI. A daily GitHub Actions cron pulls a snapshot from the **Taostats free-tier API** (5 calls/min — paced) into a static **`network.json`** that is this project's `prices.json`. All rendering math is client-side; no keys reach the browser. `bittensor` SDK / `btcli` against a public Subtensor endpoint is an acceptable free fallback. **v1 snapshots subnet-level aggregates only** (emission share, alpha price, market cap, validator/miner counts, real-revenue signal where available, registration/deregistration events). Full per-subnet weight matrices (`subnet.W`) are Phase 2.

### D4 — The honesty layer is mandatory, not decorative

Show what an insider dashboard won't. Emission-farming / subsidy cells render cold; subnets with real paid AI usage render warm. Deregistrations are deaths; new registrations are ignitions. Owner-burn and lopsided "one miner takes everything" distributions are surfaced, not hidden. **A mismatch between render and chain state is a product bug, not an edge case.** Pretty earns its keep only by being true.

### D5 — Delegate-to-power-this, baked in from v1

A "delegate to power this" panel ships in v1, wired to a **partner validator on revenue-share** — the TAO-native equivalent of BWI's Lightning tip jar, but recurring yield rather than one-off sats. Architected to **repoint to our own validator hotkey later without a redesign** (graduation path: partner now → own validator once delegation volume and ops justify it). Payoff mechanic: render our own validator as a living cell inside the organism so a user can watch the stake they just delegated flow in on the next heartbeat. The tool that visualises the incentive network is itself a node in it. **No private keys, seed phrases, or signing flows are handled by us at v1** — delegation is initiated through the user's own wallet. We display and direct; we never custody.

### D6 — Portrait, not explorer (positioning guardrail)

Taostats and TaoScope own the operator/analytics quadrant — fast tables for people debugging their own stake. **Do not compete there** — we lose on depth and speed and it isn't our game. We win on experience, emotion, and originality, which they explicitly disavow. Concretely: no metagraph tables, no validator leaderboards-as-tables, no "compare" grids in v1. The ambient, leave-it-open-and-watch-it-breathe quality is a feature.

### D7 — Time and sound

Default playback is a gentle **time-lapse of the most recent real beats**, looping, labelled as time-lapsed. A **date/time scrubber** (reusing the BWI muscle) lets viewers travel the network's life — dTAO launch, December 2025 halving, May 2026 refactor. **Sonification** — one soft sub-bass thud per epoch; each subnet hums a faint tone so the field is a slowly re-voicing chord — is **opt-in and off by default**, persisted via URL state (same pattern as the BWI Pu-238 Geiger crackle). Scrubber and sound are lightest-priority in v1; if a stage runs long, they degrade to a follow-up before anything earlier is compromised.

---

## 2026-06-04 — Bootstrap operational choices

Captured during Stage 1; not in the original locked-decisions list but worth recording.

- **Node version pinned to `>=22` (LTS).** `.nvmrc` set to `22`. Local dev machine runs v26 (forward-compatible). CI uses 22 for reproducibility. Rationale: Node 22 is active LTS and the safe default for a static-site CI pipeline; v26 satisfies `>=22` so the user's local env works without change.
- **ESLint + Prettier included in the scaffold.** Default scaffold choice; standard hygiene for a public-ish repo.
- **`adapter-static` configured with `strict: true`.** Any non-prerenderable route fails the build — catches mistakes early on a site that is supposed to be fully static.
- **Existing remote `README.md` (12 bytes) preserved in git history** and rewritten on top rather than force-pushed. Stage 1 history begins with the remote's initial commit.
