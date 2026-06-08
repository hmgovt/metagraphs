# Stage 5 — The bloom

_Read `00-OVERVIEW.md`, the Stage 4 close-out in `PROJECT-STATUS.md`, `SPEC.md §3.1`–`§3.8`, `§4` (the aesthetic guardrail — still load-bearing), `§7.4` (snapshot schema), `DECISIONS.md` D1, D2, D6, D11, D12, D13, D14, and `src/lib/field/Field.svelte` (you are extending it, not replacing it) before any code. Run this stage on the latest available Claude Opus. Stop-and-confirm at the Stage 5 boundary — do not start whatever Stage 6 becomes._

## What this stage is

The cell becomes legible. At rest, the field still reads as Stage 4 — bioluminescent organism, vivid cyan-cold tail, gold-warm head, microscope zoom. The change is in **what happens when the cursor lingers on a cell**: the cell does not pop a panel. It **blooms**. Eight filaments unspool from its surface like a coronal mass ejection — ignited at a magnetic footpoint, ejected outward along a helically-twisted plasma channel, deformed by the fields of neighbouring cells, then cooling through cyan and amber to a steady ionized afterglow in which the text becomes legible. Each filament is one **segment** of the subnet's anatomy: identity, purpose, emission, signal, age, trend, network, links. The segments are the same across every cell, in the same angular positions, so the user learns the geography.

The pre-Stage 5 detail surface is a click-stub that says "detail coming soon · phase 2." Stage 5 is phase 2, with the panel replaced by a physically-modelled bloom. The Yuma-epoch-locked heartbeat and births/deaths originally scoped for this stage move to **Stage 6**. The bloom is too important to share a stage with anything else.

The success criterion is sensory. Two tests:

1. **Jaw-drop test.** A first-time viewer hovers a warm cell at default zoom and watches the field erupt into a brief cinematic cascade — eight filaments unfurling, twisting, cooling to text — and audibly reacts. If the response is "oh that's cool," the stage has failed; we are aiming for "wait, do that again."
2. **Legibility test.** Once the cascade settles, every fact is readable without squinting. The afterglow is a steady illumination, not a flicker. Cursor over a single segment in microscope-zoom mode triggers a targeted re-flare for that one filament. The user can sit and read the cell.

**D2 still applies.** The bloom is not a node-link diagram. Filaments are anchored at one end (the cell) and terminate in text terminals in free space. They do not connect cells to other cells. The lensing effect that warps a filament toward a high-emission neighbour is **visual deformation of the same filament**, not a drawn edge between cells. If a screenshot looks like a constellation diagram, the stage has failed.

## Step 0 — Comprehension (before writing any code)

Read in this order:

1. `docs/handoff/00-OVERVIEW.md` — D1 through D7.
2. `SPEC.md` — `§3.1` (cell), `§3.2` (heartbeat — still ambient at this stage; D11 moved colour earlier, not pulse), `§3.3` (honesty colouring — fully wired since Stage 4), `§3.7` (microscope zoom), `§3.8` (logos schema v2), `§4` (aesthetic guardrail), `§7.4` (schema — Stage 5 bumps it to v3), `§9` (engineering constraints).
3. `DECISIONS.md` — D1, D2, D6, D11, D12, D13, D14.
4. `src/lib/field/Field.svelte` — the chassis you extend. The bloom mounts inside the same Three.js scene; the text terminals are HTML overlays positioned by per-frame projection (same technique already used for the zoom labels and logo overlays).
5. `src/lib/field/temperature.ts` — the existing 0..1 mapping. The bloom shader will reuse `realRevenueSignal` to drive plasma cooling colour.
6. `src/lib/state/network.svelte.ts` — the rollout-compatible store. Stage 5 bumps `ACCEPTED_SCHEMA_VERSIONS` to `[1, 2, 3]`.
7. `scripts/fetchers-taostats.ts` — the identity-endpoint integration from Stage 4 (logos). Stage 5 extracts more fields from the same endpoint.
8. **Real solar physics, briefly.** Not a deep dive; just look at five seconds of any CME video and three seconds of a quiescent solar prominence. The shape you are aiming for: plasma erupting along a curved field line, helically twisted, with a bright moving front and a slow cool-down. SDO/AIA imagery in the 171 Å channel is the visual reference.

Summarise back, in your own words: which fields per `SubnetRow` Stage 5 adds (description, social links, deltas), the eight canonical segments and their angular positions, the bloom lifecycle's five phases and their durations, why the filament physics is computed once per ignition and then animated (not re-solved per frame), and the failure mode if any filament is drawn as a straight line between two cells.

## Why this matters (the metaphor, briefly)

The cell is already a star. Stage 4 established that — a phyllotaxis of bioluminescent points, intensity from emission, colour temperature from real-revenue honesty. Stage 5 is what stars actually do when you look at them: they have **anatomy that lives in the corona**. The disc is not where most of the interesting structure is. The interesting structure is in the magnetic field lines arcing out of the surface, the prominences suspended in those fields, the flares erupting along reconnection lines.

This is not decoration. The physical model is what makes the data legible:

- **A long filament is a literally long quantity** (emission share, age) — you read magnitude by extent.
- **A twisted filament is a volatile quantity** (recent growth or shrinkage) — you read volatility by helical wraps.
- **A filament bent toward a neighbour is a contested quantity** ($tao-flow dominance) — you read economic gravity by curvature.
- **A bright filament that fades to cold afterglow is an honest filament**; one that flickers and never settles is a noisy one — you read signal quality by the cooling profile.

The viewer who learns these encodings starts reading the cell at a glance. The bloom is not telling them the data with text; the bloom **is** the data, with text labels in the afterglow as the final layer for the exact numbers. That is the load-bearing design claim.

## The physical model — four fields, one filament

A filament is a 1D plasma channel with position, length, twist, and temperature. At ignition, all four properties are computed once from the cell's state and the surrounding fields. After ignition, only the per-frame animation phase advances — the path itself does not re-solve. This is the simplest model that looks physical, and it is the model.

### Field 1 — the emission field $E$

A scalar field defined at every point in the visualization plane:

$$E(p) = \sum_{c \in \text{cells}} \frac{\text{emissionShare}(c)}{|p - \text{pos}(c)|^2 + \epsilon}$$

with $\epsilon \approx 0.01$ to keep the sum finite at the cell's own position. This is a standard 1/r² field — every cell's emission share contributes a Newtonian potential at every point.

The emission field's **gradient** is what bends filaments. At the apex of an erupting filament, the local gradient $\nabla E$ at that point is sampled, and the filament's path is deflected along it. Computationally this is a single field-lookup per filament at ignition time (we don't need to integrate along the path — we sample once at the segment's default direction at 2× cell radius and bend the whole path toward the resulting vector).

This produces the **economic-lensing** visual: a filament from a tiny cell adjacent to Subnet 64 (Chutes, dominant emitter) noticeably curves toward Chutes. A filament from Chutes itself curves toward… nothing in particular, because Chutes dominates its own neighbourhood. That is exactly the right reading.

### Field 2 — the honesty field $H$

The temperature channel from Stage 4, lifted directly. $H(c) = \text{realRevenueSignal}(c) \in [0, 1]$, defined per-cell. There is no spatial interpolation — honesty is a property of the cell, not of the space around it.

Honesty sets the **plasma cooling profile**. A high-$H$ cell has a clean cooling curve: bright white at peak → cyan → amber → steady amber-red afterglow. A low-$H$ cell has a noisy cooling curve: the peak is dimmer, the cyan phase shorter, the afterglow flickers between amber and cold red. The text emerges in both cases (it must — we are not hiding low-honesty data), but the cool-down communicates the signal quality before the user reads the value.

### Field 3 — the time field $T$

$T(c) = \text{daysSinceRegistration}(c)$, computed in the pivot from `registeredAtBlock` and the current snapshot block. Stage 5 adds `daysSinceRegistration: number` to the schema (so the browser doesn't need to know block-time conversions).

Time sets the **filament stiffness and twist count**. A very new cell (T < 14 days) has filaments that are short, ragged, with high-frequency low-amplitude jitter — they look frantic. An old cell (T > 365 days) has filaments that are long, smooth, with broad slow helical twists — they look statesman-like. The twist frequency is roughly $\omega = 4 + 8 \cdot e^{-T/30}$; the jitter amplitude scales by $e^{-T/14}$.

### Field 4 — the $tao field $\Phi$

A directional field, not a scalar. $\Phi(c)$ is a 2D vector representing the net flow of $tao into or out of the subnet over the last 24 h:

$$\Phi(c) = (\text{realRevenue}_{24h}(c) - \text{emission}_{24h}(c)) \cdot \hat{n}(c)$$

where $\hat{n}(c)$ is the unit vector from the cell to the centroid of the field weighted by emission share — i.e., the direction "toward the network's centre of mass." When real revenue exceeds emission, $\Phi$ points toward the centre (the subnet is **earning its keep**); when emission exceeds revenue, $\Phi$ points outward (the subnet is **draining**).

The $tao field rotates the **entire bloom orientation** slightly. A net-earner's bloom orients its filaments preferentially toward the network centre; a net-drainer's bloom orients outward. This is a subtle effect (max ~15° rotation) but it is the visual signature of economic direction. Two cells with identical state but opposite $tao flow look unmistakably different.

### How a single filament is computed at ignition

Given a hovered segment $s$ on cell $c$, at ignition time we compute the filament's path as a cubic Bezier with four control points $P_0, P_1, P_2, P_3$:

1. $P_0$ = cell surface point at segment $s$'s default angle, offset outward by `cellRadius + 0.005`.
2. Base direction $\hat{d}$ = unit vector at segment angle, **rotated by $\Phi(c)$'s influence**.
3. Filament length $L$ = segment-specific scaling. For the emission filament, $L = 0.04 + 0.18 \cdot \text{emissionShare}$. For the age filament, $L = 0.04 + 0.08 \cdot \log(1 + T/30)$. For identity/purpose/links, $L$ is constant (≈ 0.12).
4. $P_3$ = $P_0 + L \cdot \hat{d}$, then **bent** by adding $0.4 L \cdot \nabla E(P_3) / \|\nabla E\|$ — pulls the terminus toward the strongest neighbouring emitter.
5. $P_1, P_2$ are interpolated along the $P_0 \to P_3$ line with lateral offset proportional to the cell's volatility (see Field 3). For the curve to look like a coronal arch and not a straight line, $P_1$ sits at $\sim 0.33 L$ with lateral offset $0.08 L \cdot (1 - T/365)$ perpendicular to $\hat{d}$; $P_2$ sits at $\sim 0.67 L$ with the opposite-sign offset.

This is **five lines of vector math at ignition time**, executed once per filament. After that, the curve is fixed; the animation drives only the moving front, the plasma temperature, the helical twist phase, and the alpha. This is the discipline that lets us animate up to 8 simultaneous filaments per cell without a frame-budget worry.

## The eight segments

Same for every cell. Same angular positions. The geography is learnable in three hover-passes.

| # | Segment   | Clock angle | What the filament carries                                          | Filament length driver        |
|---|-----------|-------------|--------------------------------------------------------------------|-------------------------------|
| 1 | Identity  | 12:00       | Name, UID, logo (if present)                                       | constant                      |
| 2 | Purpose   | 1:30        | Description — 1–2 sentences from Taostats identity endpoint        | constant                      |
| 3 | Emission  | 3:00        | Current emission share %, TAO/day                                  | `emissionShare` (literal)     |
| 4 | Signal    | 4:30        | Real-revenue signal narrative ("honest revenue $42k/mo" or "subsidy-farming · signal 0.02") | `realRevenueSignal` (literal) |
| 5 | Age       | 6:00        | "Registered N days ago" + cohort badge                             | `daysSinceRegistration` (log) |
| 6 | Trend     | 7:30        | 24h / 7-epoch emission delta with arrow                            | `|emissionShareDelta24h|`     |
| 7 | Network   | 9:00        | Validator count, miner count                                       | constant                      |
| 8 | Links     | 10:30       | GitHub, Twitter, Discord, website — clickable terminals            | constant                      |

The clock-face arrangement is a deliberate ergonomic choice: it lets the user develop muscle memory ("emission is at 3 o'clock") so once they have learned the geography they can target a segment without reading any signage. The first time a user hovers a cell, they get the full cascade in clock order; from then on they can target individual segments deliberately.

**Filament length is not the only encoding** — for segments where length is data (3, 5, 6), the filament's stretch is the data, and the text terminal shows the exact number for the precise reader. For segments where length is constant (1, 2, 7, 8), the filament is just a delivery mechanism for the text.

## The bloom lifecycle

Per-filament, five phases. Durations are tunable but these are the calibration starting points.

| Phase       | Duration  | What happens                                                                                              |
|-------------|-----------|-----------------------------------------------------------------------------------------------------------|
| Ignition    | 0–150 ms  | Bright white-hot point flares at the segment's footpoint on the cell surface. No filament visible yet. The cell itself brightens by ~30%. |
| Eruption    | 150–800 ms| Filament unspools along its Bezier path. The "moving front" — a bright cyan-white maximum — travels from $P_0$ to $P_3$. The plasma behind the front is bright cyan; ahead of the front, dark. |
| Apex        | 800–1200 ms| Front reaches $P_3$. Whole filament now visible, full helical twist phase advancing. Brightest moment overall. The text terminal at $P_3$ has not appeared yet. |
| Cooling     | 1200–2200 ms| Plasma cools along the colour curve: cyan-white → cyan → amber → deep red. Brightness drops to ~30% of apex. Text terminal at $P_3$ fades in over the final 500 ms of this phase, starting around the moment the filament reaches a deep amber. |
| Afterglow   | 2200 ms+  | Steady illumination. Filament is a dim copper-red glow with subtle plasma turbulence (low-amplitude shader noise). Text terminal at $P_3$ is fully visible. State holds as long as the cursor is on the segment. |

**Sustain.** Once a filament reaches afterglow, it stays there until the cursor leaves the segment. Hovering a *different* segment doesn't extinguish the current one — it ignites a new one. Multiple sustained filaments can coexist (up to all 8). When the cursor leaves a cell entirely, all sustained filaments enter the decay phase.

**Decay.** 600 ms ease-out fade. The text terminal fades first (~300 ms), then the filament cools to invisibility along the same colour curve in reverse, contracting slightly toward $P_0$.

**Interruption.** If the user re-hovers the same segment during decay, ignition restarts cleanly from current state — no double-fire, no flicker.

## Interaction model — two modes, one cell

The mode depends on `camera.zoom`. Both modes share the lifecycle above; they differ in **how a segment is selected**.

### Mode A — cascade (default zoom)

At `camera.zoom < CASCADE_THRESHOLD` (= 2.0; below the existing `NAME_LABEL_ZOOM_THRESHOLD` of 2.4 so labels and cascades don't overlap modes), cells are too small to target individual segments precisely. Hovering anywhere on a cell's interaction halo (~1.4× visible radius, same as the existing raycast multiplier) triggers a **waterfall cascade**: all eight segments ignite in clock-order with a stagger of 90 ms between them.

The total cascade duration is:
- Last segment ignites at $8 \times 90 = 720$ ms
- Last segment reaches afterglow at $720 + 2200 = 2920$ ms
- So a full bloom from start to fully-readable is about **3 seconds**.

After the cascade settles, all 8 filaments are sustained until the cursor leaves the cell. The user reads at leisure. This is the **cinematic** mode — what a first-time viewer sees, what makes the jaw drop.

### Mode B — deliberate (microscope zoom)

At `camera.zoom ≥ CASCADE_THRESHOLD`, the cell is large enough on screen that the 8 segments can be individually targeted. Eight **sigils** appear as small dim glyphs around the cell at clock positions, fading in over 300 ms when the cursor enters the cell's interaction halo. Each sigil is a hover target ~12 px in diameter at screen scale (so they remain pickable at any zoom).

Hovering a specific sigil ignites *only* that segment's filament. Moving the cursor to a second sigil ignites a second filament alongside the first. Moving off the cell entirely decays all sustained filaments.

A right-click (or `f` keypress while a cell is focused) in Mode B forces a full cascade like Mode A — the user can always summon the cinematic if they want it, even when zoomed in.

### Keyboard parity

- `Tab` advances focus to the nearest cell.
- Arrow keys move focus to the spatially-nearest neighbour cell in that direction.
- `1` through `8` ignite the corresponding segment on the focused cell. `0` triggers a cascade.
- `Escape` decays all sustained filaments on the focused cell.

### Reduced motion

`prefers-reduced-motion: reduce` collapses the lifecycle to two phases: ignition (50 ms) → afterglow (immediate). No moving front, no cooling animation, no helical twist phase. The filament appears as a static dim arc with the text terminal already present. Same data, no motion. This is non-negotiable — the bloom is dramatic and we cannot trap users with vestibular sensitivity.

## Rendering — Three.js ribbons + HTML overlay text

The filament body is WebGL. The text terminals are HTML. The split is deliberate: WebGL is the right tool for animated plasma; HTML is the right tool for legible text with selectable / copyable / linkable content.

### Filament body — `MeshLine`-style ribbons

A ribbon is a triangle strip built from the Bezier path, sampled at ~32 points, with a small lateral width (~3 px at screen scale). We are not using `three/examples/jsm/lines/Line2.js` — Line2 is great for static fat lines but is awkward for the per-vertex shader work we need. Instead, write a custom ribbon:

- Build a `BufferGeometry` with `2 × N` vertices (left and right edges of the strip) and `(2N - 2) × 3` indices for the triangles.
- Per-vertex attributes: `aT` (0..1 path parameter), `aSide` (-1 or +1 for left/right edge).
- Vertex shader: reads the Bezier control points from uniforms, computes the position at `aT`, perpendicular at `aT`, displaces by `aSide × ribbonHalfWidth`. Adds the helical twist by rotating the perpendicular around the tangent by `twistAmp × sin(aT × twistFreq × 2π + uPhase)`.
- Fragment shader:
  - **Moving front:** `front = smoothstep(uFront - 0.05, uFront, aT) - smoothstep(uFront, uFront + 0.05, aT)` — a narrow bright band that travels along the path as `uFront` advances from 0 to 1 during eruption.
  - **Plasma temperature curve:** a gradient sampled by `phaseT = clamp((uTimeSinceIgnition - eruptionEnd) / coolingDuration, 0, 1)`. The colour stops are precomputed: `WHITE = vec3(1.0, 0.95, 0.9)`, `CYAN = vec3(0.55, 0.92, 1.0)`, `AMBER = vec3(1.0, 0.65, 0.25)`, `RED = vec3(0.55, 0.1, 0.05)`. `phaseT < 0.25` interpolates white→cyan, `0.25–0.6` cyan→amber, `0.6–1.0` amber→red.
  - **Honesty noise:** for low-`realRevenueSignal` cells, add a low-amplitude `fbm(aT × 16 + uTime)` flicker to brightness. For high-signal cells, the surface is calm.
  - **Edge softening:** alpha falls off near `|aSide|` boundary via `1 - aSide × aSide` so the ribbon has soft edges, not hard polygon seams.
- Additive blending. `depthWrite: false`. Same blend mode as the cells.

One `Mesh` per active filament. Maximum 256 cells × 8 filaments = 2048 possible filaments. In practice we cap **active simultaneously** at 32 (4 cells × 8) — any more and the user has lost track. Older filaments past the cap get fast-decayed.

### Text terminal — HTML overlay

Same pattern as the existing zoom label / logo overlay system. A `<div class="filament-terminal">` is created per active filament. Each frame, project $P_3$ from world space to screen space and update `transform: translate3d(x, y, 0)`. Style:

- Small mono font (the same `--font-mono` already in use).
- `color: #f3d6a8` (the amber-red afterglow temperature). `opacity` driven by the cooling phase progress.
- **Diffuse border for legibility** (essential, not optional). Each terminal renders its text with a multi-stop diffuse halo so the subnet name and value remain legible against any underlying field colour — including over a bright warm cell adjacent to its own bloom. Implementation: layered `text-shadow` with three soft stops at increasing radius:
  ```css
  text-shadow:
    0 0 2px rgba(8, 6, 14, 0.95),    /* tight dark backing — kills any overlap with cell glow */
    0 0 6px rgba(8, 6, 14, 0.75),    /* mid diffuse — softens the dark backing's edge */
    0 0 14px rgba(255, 180, 100, 0.45); /* outer plasma glow — restores the warm afterglow halo */
  ```
  The Identity segment's name is the most critical to legibility — its dark backing radius bumps up by 50% (`0 0 3px / 0 0 9px / 0 0 18px`) and the font weight rises one step. Names must remain readable at the smallest target font size on any background.
- `pointer-events: auto` only after afterglow start; before that, pointer-events: none (the user shouldn't be able to misclick into a half-formed text element).
- For the Links segment, the terminal is a row of small clickable icons (`<a target="_blank" rel="noreferrer">`); each icon is the same amber-red, with hover-brighten.

Z-index ordering: filament canvas at base, text terminals above, zoom labels and logos at the top (they remain interactive). The terminals are pinned to projected world points; on resize / zoom, they re-project per frame — this is cheap.

### Performance budget

- 32 simultaneous filaments × 32 path samples = 1024 vertices per frame. Trivial.
- Per-filament uniform updates per frame: ~6 floats (front, phase, time since ignition, twist amp, etc.). Trivial.
- Text terminals are DOM. On a typical hover-cascade with 8 terminals, you have 8 elements being translated per frame. Browsers are good at this; `transform` is on the compositor.
- The cell field shader from Stage 4 is unchanged. Stage 5 adds work to the scene only when a cell is bloomed.

Target: 60 fps on a 2019 MacBook Pro at default zoom with one cell fully bloomed. 30 fps acceptable on mobile Safari.

## Schema v3 — what gets added

Stage 5 bumps the snapshot schema to **version 3**. The browser store accepts `[1, 2, 3]` (the rollout-compatible store pattern from Stage 4 generalises — `ACCEPTED_SCHEMA_VERSIONS` just gains a new entry).

### Per-subnet additions

```ts
interface SubnetRow {
  // … existing v2 fields …

  // v3 — for the bloom (SPEC §3.9, this stage)
  description: string | null;        // 1–2 sentences from Taostats identity. null when unavailable.
  github: string | null;             // owner-declared URL or null
  twitter: string | null;
  discord: string | null;
  website: string | null;

  daysSinceRegistration: number;     // computed in pivot: (currentBlock - registeredAtBlock) / 7200

  validatorCount: number | null;     // from Taostats subnet/latest if present, else null
  minerCount: number | null;

  emissionShareDelta24h: number | null;       // currentShare - shareNEpochsAgo where N ≈ 20
  emissionShareDelta7epoch: number | null;    // shorter window for trend sensitivity
  realRevenueSignalDelta24h: number | null;
  rankDelta24h: number | null;                // change in emission-rank position
}
```

All new fields are `| null` so v2 NDJSON rows (pre-2026-06-08) can be pivoted into v3 shape via the same `normaliseSubnetForSchemaV3` backfill pattern used in Stage 4. The defensible default for every nullable field is `null` — the §3.3 "labelled neutral state" contract holds.

### `static/network.schema.json` — bump const to 3, add all new fields to `properties`. `description`, `github`, `twitter`, `discord`, `website`, `daysSinceRegistration` move to `required`; the deltas and counts stay optional because they require a window of history that the first post-deploy snapshot may not have. The browser treats `null` deltas as "no signal yet" (neutral arrow, no number).

### Required vs. optional rationale

- `description` is required at schema level but allowed to be `null` at value level — the field must be present, the value can be null when Taostats doesn't have one. Same pattern as `logoUrl` in v2.
- `daysSinceRegistration` is required and non-null because the pivot always has the math (current block - `registeredAtBlock` is always defined).
- Deltas are optional at schema level because the pipeline cannot compute them until it has > 24 h of history; for the first 20 snapshots after the v3 cutover, deltas may be absent. Optional + null-tolerant browser rendering avoids a chicken-and-egg problem.

## Pipeline changes

### `scripts/fetchers-taostats.ts`

Currently `fetchSubnetLogos(apiKey)` returns `Map<uid, string|null>` from the identity endpoint. Rename to `fetchSubnetIdentity(apiKey)` and return:

```ts
Map<uid, {
  logoUrl: string | null;
  description: string | null;
  github: string | null;
  twitter: string | null;
  discord: string | null;
  website: string | null;
  validatorCount: number | null;
  minerCount: number | null;
}>
```

The identity endpoint already returns all of these in its row (`description`, `github_url`, `twitter_url`, etc.). Extract them in the same pass. Free-tier discipline is unchanged — this is still one call.

### `scripts/fetch-snapshot.ts`

- Replace the `fetchSubnetLogos` call site with `fetchSubnetIdentity`, merging all eight fields into the rows.
- Compute `daysSinceRegistration` per row: `(headBlock - registeredAtBlock) / 7200` (Bittensor block time is ~12 s, so 7200 blocks per day). Round to 1 decimal.
- Compute deltas in a new helper `computeDeltas(currentRows, ndjsonHistory)`:
  - For each cell, look up the row from ~20 epochs ago (24 h ago) and ~7 epochs ago (∼8 h ago).
  - Compute `emissionShareDelta24h = currentShare - share24hAgo` (returns `null` if no row found).
  - Same for `realRevenueSignalDelta24h`.
  - Compute `rankDelta24h` by ranking both windows and subtracting.
- The `needsSchemaUpgrade` check from Stage 4 already exists; bump `CURRENT_SCHEMA_VERSION` to 3 and it triggers an automatic re-fetch on the first run after the cutover. Defence in depth, same as Stage 4.

### `scripts/build-network-json.ts`

- `schemaVersion: 3` in the pivot.
- Add `normaliseSubnetForSchemaV3(s)` that backfills every new field to `null` (for description / urls / counts / deltas) or computes from existing data where possible (for `daysSinceRegistration` — but it should always be present from the fetcher; this is a safety net).
- The existing `normaliseSubnetForSchemaV2` chain composes: v2-shaped NDJSON gets normalised to v2, then v3 normalises on top. Keep both functions; don't merge.

### CI workflow

The Stage 4 fix (`git checkout main -- scripts/ static/network.schema.json`) and the jsDelivr purge step already handle the schema rollout machinery. No workflow changes for Stage 5. The first scheduled run after the schema-v3 push will fetch, re-pivot, validate, commit, and purge the edge cache.

## Browser changes

### `src/lib/types/network.ts`

Add the v3 fields to `SubnetRow`. The `NetworkJson` type's `schemaVersion: 1 | 2` becomes `1 | 2 | 3`. Same rollout-window pattern as v2.

### `src/lib/state/network.svelte.ts`

`ACCEPTED_SCHEMA_VERSIONS` becomes `[1, 2, 3]`. One-line change.

### `src/lib/field/Field.svelte`

Extend, don't replace:

- Add per-cell hover detection beyond the existing click raycast. Use the same raycaster but track `hoveredCellUid` in a `$state` separate from clicked state.
- On hover-enter: start the bloom orchestrator for that cell.
- On hover-leave: kick off decay for all sustained filaments.
- The cell instance itself gains a 30% intensity boost during bloom — modulate `aIntensity` in the existing field shader by a `boostMap: Float32Array(MAX_SUBNETS)` updated per frame from the bloom state.

### New: `src/lib/field/bloom/` directory

The bloom is large enough to warrant its own subdirectory. Modules:

- `segments.ts` — the canonical eight: angle, length-driver, label, terminal renderer. Pure data + functions; no DOM, no Three.
- `fields.ts` — pure-math implementations of the four physical fields. Inputs: cells array, target point. Outputs: scalar / vector. Testable in isolation.
- `physics.ts` — `computeFilamentPath(cell, segment, allCells): BezierCurve` — the one-shot ignition-time math.
- `lifecycle.ts` — the phase machine. State: `igniting | erupting | apex | cooling | afterglow | decaying | extinct`. Pure; takes time since ignition, returns phase + per-phase progress 0..1.
- `shaders.ts` — vertex + fragment for the ribbon. Same shape as `field/shaders.ts`.
- `Bloom.svelte` — the Three.js scene additions. Holds the per-filament `Mesh` registry, dispatches lifecycle updates per frame, projects $P_3$ for terminals.
- `BloomTerminal.svelte` — the HTML overlay for a single text terminal. Receives projected screen coords + segment data + cooling phase as props.
- `config.ts` — calibration constants (cascade stagger, phase durations, twist parameters, ribbon width, plasma stops).

### `src/lib/field/SubnetTooltip.svelte` — delete

The phase-2 stub is gone. The bloom replaces it. Update any imports.

## SPEC and DECISIONS

### SPEC updates (after build, before merge)

- **§3.9 — The bloom (NEW).** The four fields, the eight segments, the lifecycle, the two modes. Schema v3 reference.
- **§7.4 — Snapshot schema.** Add v3 example. History subsection notes the v2 → v3 cutover date and the rollout-compatible store pattern unchanged.
- **§3.1 — The cell.** Add a sentence: "On hover, the cell blooms — see §3.9." Do not duplicate §3.9's content here.
- **§10 — Stage table.** Mark Stage 5 done at the bloom. Stage 6 becomes the heartbeat (epoch-locked pulse + births/deaths + signal refinement, originally Stage 5's scope).

### DECISIONS updates

- **D15 — The bloom replaces the click-detail panel.** Dated. Rationale: a panel breaks the field metaphor; a coronal-flare bloom extends it. The detail surface is now in-canvas (filament) + HTML overlay (text terminal), not a separate UI region.
- **D16 — Hover as primary interaction, click as secondary.** Dated. Rationale: cinematic cascades are best discovered, not clicked. Click on links inside terminals remains.
- **D17 — Schema v3 — full subnet identity + computed deltas.** Dated. Rationale: the bloom is information-dense; the data has to land in one snapshot fetch.

The renumbering is intentional. D14 was logos; D15–D17 are the bloom decisions; future stages continue from D18.

## Calibration knobs (the file you tune by eye, not by formula)

`src/lib/field/bloom/config.ts`:

```ts
// Mode threshold (uses the same axis as Stage 4 zoom labels)
export const CASCADE_THRESHOLD = 2.0;

// Lifecycle phase durations (ms)
export const IGNITION_MS = 150;
export const ERUPTION_MS = 650;
export const APEX_MS = 400;
export const COOLING_MS = 1000;
export const DECAY_MS = 600;

// Cascade stagger between segments in Mode A
export const CASCADE_STAGGER_MS = 90;

// Maximum simultaneously active filaments (FIFO decay past cap)
export const MAX_ACTIVE_FILAMENTS = 32;

// Ribbon
export const RIBBON_HALF_WIDTH_PX = 1.5;
export const RIBBON_SAMPLES = 32;

// Twist (helical wraps along the filament)
export const TWIST_AMP_BASE = 0.06;     // displacement in field units
export const TWIST_FREQ_MIN = 4;        // for old cells
export const TWIST_FREQ_MAX = 12;       // for new cells; interpolated by age

// Plasma colour stops
export const C_WHITE = [1.0, 0.95, 0.9];
export const C_CYAN  = [0.55, 0.92, 1.0];
export const C_AMBER = [1.0, 0.65, 0.25];
export const C_RED   = [0.55, 0.1, 0.05];

// Field deformation gains
export const LENSING_GAIN = 0.4;        // how much ∇E bends the terminus
export const TAO_ROTATION_MAX_DEG = 15; // max bloom orientation tilt from Φ

// Cell brightness boost during bloom
export const BLOOM_BRIGHTNESS_BOOST = 0.3;

// Filament length drivers (per segment)
export const EMISSION_FILAMENT_BASE = 0.04;
export const EMISSION_FILAMENT_SCALE = 0.18;
export const AGE_FILAMENT_BASE = 0.04;
export const AGE_FILAMENT_SCALE = 0.08;
export const CONSTANT_FILAMENT_LENGTH = 0.12;
```

**Tune by eye, not by formula.** Bring up the dev server at real data. Hover Subnet 64 (Chutes — currently the dominant emitter) and tune until the cascade feels like a coronal mass ejection. Hover Subnet 1 and verify the old-statesman calm. Hover a brand-new subnet and verify the frantic short flares. Then tune until all three feel like the same physics with different cells, not three different effects.

## Choreography — easings

Five-phase lifecycle, five easings:

- **Ignition (brightness ramp):** `easeOutBack` — the cell punches above its resting brightness briefly before settling. ~150 ms.
- **Eruption (moving front from 0 → 1):** `easeOutQuad` — fast start, decelerating. The plasma sprints out then slows as it approaches the apex.
- **Apex (twist phase fully active):** linear. No easing; constant rotation.
- **Cooling (plasma temperature 0 → 1):** `easeInOutCubic` — slow start (lingering at hot), accelerating middle (rapid cyan→amber), slow end (lingering at warm). This is the dramatic moment; don't rush it.
- **Decay (alpha 1 → 0):** `easeInQuad` — slow start (the user can interrupt by re-hovering), accelerating finish. Symmetric with eruption but on the alpha channel.

Implement easings inline (the existing `easeOutCubic` in `Field.svelte`'s zoom tween is the template — just add the others).

## What this stage explicitly does NOT do

- **No epoch-locked heartbeat.** The cell's ambient breathe is unchanged. Stage 6 plugs the chain pulse into the same shader uniform.
- **No births / deaths.** The `aAlive` attribute remains 0/1 per snapshot. Stage 6 animates the transition.
- **No edges between cells.** This is the third time we have said it because the bloom's lensing effect could *look* like edges if a developer over-renders the curvature. Cap the bend at $0.4 L$ and the filament always terminates in free space.
- **No category/taxonomy curation.** Categories ("inference", "storage", etc.) are not in Taostats and would require curated data. Stage 5 surfaces only what Taostats and the pipeline can compute. A curated `subnet-categories.json` is a future decision.
- **No multi-cell bloom orchestration.** Hovering many cells fast does not chain blooms together for a synchronized field-wide cascade. That would be cool, but it is a separate stage's worth of design and we are not doing it now.
- **No 3D.** The bloom is in the existing 2D field plane. A 3D bloom (filaments out of the page) is structurally tempting but kills the ergonomic clarity of the clock-face layout. Decline.

## Acceptance — when Stage 5 is done

A user opens https://metagraphs.live/ on a fresh tab. The field renders, cyan-cold tail and gold-warm head, microscope zoom available. They hover their cursor over the brightest gold cell. Within 3 seconds they see eight filaments unfurl in coronal-flare cascade, twist visibly as the plasma cools, and settle into a steady amber afterglow with the cell's identity, purpose, emission, signal, age, trend, network, and links written along them. They read the cell. They mouse off, and the bloom decays in 600 ms.

They wheel-zoom into the field. The cell grows. They see eight small sigils around it. They hover the 3-o'clock sigil and the emission filament re-flares alone, its length proportional to the subnet's emission share. They hover 6 o'clock; the age filament joins it. They read both. They press Escape; everything fades.

They hover a subsidy-farming cell in the cold tail. Same eight segments, but the plasma cools messily — the cyan phase is short, the amber flickers, the afterglow has visible noise. The signal filament's narrative reads "subsidy-farming · signal 0.02." The user understands the cell's dishonesty without reading the number, because the bloom *looked dishonest*.

They open the network at default zoom on a phone. The reduced-motion check trips automatically on no-hover devices: tap a cell, get a static low-motion bloom with all eight terminals already legible. Same data; appropriate motion.

That is Stage 5 shipped.

## Files this stage adds or changes

**Adds:**
- `src/lib/field/bloom/segments.ts`
- `src/lib/field/bloom/fields.ts`
- `src/lib/field/bloom/physics.ts`
- `src/lib/field/bloom/lifecycle.ts`
- `src/lib/field/bloom/shaders.ts`
- `src/lib/field/bloom/config.ts`
- `src/lib/field/bloom/Bloom.svelte`
- `src/lib/field/bloom/BloomTerminal.svelte`

**Changes:**
- `static/network.schema.json` — v3
- `src/lib/types/network.ts` — v3 fields, schemaVersion union
- `src/lib/state/network.svelte.ts` — `ACCEPTED_SCHEMA_VERSIONS = [1, 2, 3]`
- `src/lib/field/Field.svelte` — hover detection, bloom orchestrator mount, cell brightness boost
- `scripts/snapshot-types.ts` — v3 SubnetRow + SnapshotRow
- `scripts/sources.ts` — identity endpoint already present; no change
- `scripts/fetchers-taostats.ts` — rename `fetchSubnetLogos` → `fetchSubnetIdentity`, return all fields
- `scripts/fetchers-subtensor.ts` — add nulls for new fields in the fallback path
- `scripts/fetch-snapshot.ts` — extract identity fields, compute `daysSinceRegistration`, compute deltas, bump `CURRENT_SCHEMA_VERSION = 3`
- `scripts/build-network-json.ts` — `schemaVersion: 3`, add `normaliseSubnetForSchemaV3`
- `SPEC.md` — §3.9 new, §7.4 v3 example, §3.1 cross-ref, §10 stage table
- `DECISIONS.md` — D15, D16, D17
- `README.md` — Status paragraph rewrite; bloom section added under Field

**Deletes:**
- `src/lib/field/SubnetTooltip.svelte`

## Commit shape

Same per-commit discipline as Stage 4. One logical unit each. Suggested order:

1. `docs(spec): §3.9 the bloom + §7.4 schema v3 (D15/D16/D17)`
2. `feat(schema): bump to v3 — full identity + deltas (SPEC §3.9)`
3. `feat(pipeline): plumb identity fields + deltas through fetch-snapshot (schema v3)`
4. `feat(bloom): physics — fields, segments, filament path math (pure)`
5. `feat(bloom): lifecycle phase machine + easings (pure)`
6. `feat(bloom): ribbon shader + Three.js mount`
7. `feat(bloom): HTML text terminals + projection`
8. `feat(field): hover orchestrator + cell brightness boost during bloom`
9. `feat(bloom): mode A cascade + mode B deliberate sigils`
10. `feat(bloom): keyboard parity + reduced-motion fallback`
11. `docs(decisions): D15/D16/D17 + README rewrite + PROJECT-STATUS`

Each commit should leave the site buildable. Commits 4–7 may leave the bloom inert (no orchestrator wired) but should not break the field.

## A note on ambition

This stage is the largest single design move in the project's life. It is also the moment the project becomes itself. Stages 1–4 built the breathing organism; Stage 5 makes it speak. If the build is excellent — physics convincing, choreography cinematic, text legible — the project's identity is locked. If it is half-hearted, the field becomes a decorated dashboard and we have lost the argument.

Go slow. Tune by eye. Hover a real subnet a thousand times during development. The moment you can no longer tell whether you are debugging or just enjoying watching it bloom is the moment Stage 5 is done.

Stop and confirm at the Stage 5 boundary. Do not start Stage 6.
