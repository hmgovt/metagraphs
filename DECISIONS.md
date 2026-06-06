# Decisions

_A dated log of locked decisions. Newest at top. If a decision needs to change, append a new entry that supersedes the old one — do not silently rewrite._

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
