# Decisions

_A dated log of locked decisions. Newest at top. If a decision needs to change, append a new entry that supersedes the old one — do not silently rewrite._

---

## 2026-06-08 — Stage 5: the bloom

### D15 — The bloom replaces the click-detail panel (the detail surface is in-canvas, not a separate UI region)

The v1 stub said "subnet detail coming soon · phase 2" on click. Phase 2 originally meant a panel-shaped detail surface — a rectangle of text floating over the field. Building it would have surfaced the data, but it would also have admitted that the field is a launcher rather than the product. Mid-Stage-5 conversation surfaced the alternative: the cell **blooms** — eight filaments unspool from the cell surface as a coronal mass ejection, twist as the plasma cools, and settle into an amber afterglow in which the text becomes legible. The detail surface stays in the field's physical metaphor instead of breaking out of it.

This is not decoration. The filament's **length** encodes magnitude, the **twist** encodes volatility, the **curvature** encodes economic gravity from neighbouring high-emission cells, and the **cooling profile** encodes signal honesty (clean cool-down for high-signal, noisy/flickering for subsidy-farming). Text terminals at filament tips give the precise values for the careful reader; the bloom anatomy gives the legible-at-a-glance impression. A viewer who has hovered ten cells starts reading the next one before any text resolves.

Operational consequences: `src/lib/field/SubnetTooltip.svelte` is deleted. The bloom lives in `src/lib/field/bloom/` and mounts as a Three.js scene addition alongside the existing field. Full physics, choreography, and rendering details are spec'd in [`docs/handoff/05-bloom.md`](docs/handoff/05-bloom.md); §3.9 of the spec carries the executive summary.

### D16 — Hover is the primary interaction; click stays only for terminal links

The bloom is cinematic, and cinematic moments are best discovered, not summoned. Hover triggers the bloom; click only follows a link inside an exposed terminal (GitHub, Twitter, Discord, website). This is a genuine ergonomic shift from the v1 "click → panel" model — D1's "clickable cell is a no-op stub" is superseded for v1 by D16's "hover cell → bloom; click filament terminal → external link." The micro-view weight-matrix dive remains Phase 2.

At default zoom (`camera.zoom < CASCADE_THRESHOLD ≈ 2.0`), individual segments cannot be reliably targeted with the cursor, so a hover triggers a full cascade — all eight filaments ignite in clock order with a 90 ms stagger, fully readable at ~3 s (the cinematic mode). At microscope zoom, eight sigils appear around the cell; hovering an individual sigil ignites only that segment's filament (the deliberate analysis mode). Keyboard parity: `Tab` focuses the nearest cell; `1`–`8` ignite by segment; `0` cascades; `Escape` decays.

Non-hover devices (touch) read the cursor-equivalent as the first tap; a second tap on a filament terminal navigates the link. `prefers-reduced-motion: reduce` collapses the lifecycle to ignition (50 ms) → afterglow (immediate). No moving plasma front, no cooling animation, same data — the bloom is dramatic and must not trap users with vestibular sensitivity.

### D17 — Snapshot schema v3: full subnet identity + pre-computed deltas

The bloom is information-dense. Surfacing the eight segments requires data that is not in schema v2: a one-or-two-sentence subnet **description**, owner-declared **social links** (GitHub, Twitter, Discord, website), **`daysSinceRegistration`** (computed in the pivot from `registeredAtBlock` and the snapshot block — cheaper to do once in CI than 128× per page render), and **deltas** of emission share, real-revenue signal, and rank against the 24 h / 7-epoch historical windows.

Schema v3 adds all of these to `SubnetRow`. The identity fields come from the same Taostats bulk endpoint already used for `logoUrl` (`/api/subnet/identity/v1?limit=512` — one paced call, the same as v2); `fetchSubnetLogos` is renamed `fetchSubnetIdentity` and returns the full identity record per uid. Deltas are computed by the orchestrator against the running NDJSON history; the first ~20 epochs after the v3 cutover lack the 24 h window and the deltas surface as `null` — the bloom's trend filament reads `null` as "no signal yet" and renders neutrally.

The browser store accepts schemaVersion 1, 2, OR 3 during the rollout window — same pattern as v2. The pivot's `normaliseSubnetForSchemaV3` backfills nulls for any v1/v2 NDJSON row pivoted under v3, so the schema-upgrade re-fetch flow (the `needsSchemaUpgrade` check in `scripts/fetch-snapshot.ts`, already proven on the v1→v2 cutover) just works for v3 with `CURRENT_SCHEMA_VERSION = 3`.

URL fields are owner-declared and **not policed**, same posture as v2 logos. Broken links travel honestly through the snapshot; the browser handles them via `<a target="_blank" rel="noreferrer">` plus a `referrerpolicy="no-referrer"` discipline on any logo image inside terminals. Curating, rewriting, or HEAD-checking owner URLs would tilt the data architecture from "honest pipe" to "editorial layer" — that's a separate honesty contract competing with the owner's statement, and we don't build it.

---

## 2026-06-08 — Snapshot schema v2: owner-declared subnet logos

### D14 — Logos come from Taostats's identity endpoint, plumbed through the snapshot (schema v2)

Subnet logos are real signal — a viewer who zooms into the field should be able to recognise the brands that are the network's productive surface. Two paths were considered and the second discarded:

- **Convention path (rejected).** A deterministic URL pattern (`taostats.io/images/subnets/{uid}.webp`) was identified from Taostats's `metadata` endpoint and documented in a draft §3.8. Probe revealed that pattern does **not** actually serve images — those URLs return the site's SPA 404 HTML. The convention I documented was based on a wrong fact; the §3.8 clause and the browser `<img>` `src` I'd wired against it were reverted in the same session before either reached `main`.
- **Schema-bump path (taken).** Each subnet owner registers a `logo_url` via Taostats's identity endpoint, and `/api/subnet/identity/v1?limit=512` returns the entire network in **one** bulk call. The original "one call per subnet → blows the 5/min rate budget" objection was wrong — bulk fetch is cheap. The path that's honest about subnet identity is to plumb that URL through the snapshot.

Schema v2 adds `logoUrl: string | null` to `SubnetRow`. The pipeline issues one extra paced call (`fetchSubnetLogos` in [`scripts/fetchers-taostats.ts`](scripts/fetchers-taostats.ts)) and merges results into the orchestrator's SubnetRow array; failures are non-critical (logged + forward-filled from the prior row, never fatal). The Subtensor fallback returns `logoUrl: null` since the chain does not carry owner-declared metadata. The browser store accepts schemaVersion 1 OR 2 during the rollout window between this commit and the first v2 snapshot landing on the `data` branch.

**URLs are not policed.** Owner-declared URLs travel honestly through the snapshot, even when broken or stale — at the time of writing, one subnet (uid 3, "deprecated") registers literally `https://deprecated.png`. The browser handles broken URLs via `<img onerror>`. Curating, rewriting, or hosting our own mirror would be a parallel honesty layer competing with the owner's statement; we don't.

**Rendering posture (§3.8).** Logos render only **next to** the cell name label at zoom past `NAME_LABEL_ZOOM_THRESHOLD`, never on the cell glow itself. The default bioluminescent register is preserved; the microscope reveals identity.

---

## 2026-06-07 — Hero-scale field corrections (mid-Stage-4 reshape)

Captured during the Stage 4 review conversation, when the first cut of the field shipped as a small constellation of warm dots that conveyed no semantic structure. The product-level critique surfaced the gap: a portrait of an organism cannot be one that the viewer cannot read. These three decisions extend D1, D2, D4, and D6 with the corrections needed to make the field carry meaning at first glance.

### D11 — Honesty colour lands at Stage 4 (compress the 4/5 boundary)

The original staging put `realRevenueSignal → temperature` at Stage 5 so that Stage 4 could ship the chassis without depending on data semantics. In practice this produced a field of undifferentiated warm-amber cells — the brand promise (`emission-farming subnets render cold; real-revenue subnets render warm`, D4) was visually absent on day one. Stage 4 now wires the §3.3.1 signal straight through to `aTemperature` via `temperatureFor(subnet)` in [`src/lib/field/temperature.ts`](src/lib/field/temperature.ts): non-null signal passes through, null signal renders at the neutral midpoint (`§3.3` labelled neutral state). Stage 5's scope shrinks to the **Yuma-epoch-locked heartbeat + birth/death animations + signal refinement** — still substantial, but no longer the moment the honesty axis arrives.

### D12 — Microscope zoom is in scope; pan and orbit controls are not

D6's "portrait, not explorer" guardrail forbade tables, leaderboards, and compare grids. My Stage 4 prompt over-extended that into "no zoom, no pan." On reflection, **zooming into a portrait is still portraiture** — a microscope dive into the organism, not navigation of a map. Stage 4 now supports: scroll wheel and trackpad-pinch (zoom centred on cursor), double-click on a cell (zoom toward it), Escape or `0` (reset to whole-field view). Bounded `[MIN_ZOOM=1, MAX_ZOOM=5.5]` so the viewer can lean in but never loses the organism. **No drag-to-pan** — pan is the affordance that tilts the experience into "explore a map," and that's the line D6 was always trying to draw. Cell name labels fade in past `NAME_LABEL_ZOOM_THRESHOLD=2.4`, only for cells with `emissionShare > 0` (the meaningful 33, not the cold-tail 98) — curiosity is rewarded with detail, not denied.

### D13 — Field renders as the hero, not framed by chrome

Stage 4's first cut placed the field in the middle row of a `header / main / footer` grid, which boxed it to ~580 px tall on a 1280×800 viewport. The result read as a small constellation in a wide letterbox. The page chassis now puts the field at `position: absolute; inset: 0` covering the whole viewport; the header and the telemetry/attribution strip become small floating overlays with subtle gradient backgrounds for legibility. The field is the page; the chrome dim-floats over it. Pulse opacity drops to 0.35 (was 0.5) once data lands so the cells are the brightest objects on screen.

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
