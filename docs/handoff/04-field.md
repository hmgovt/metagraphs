# Stage 4 — The breathing field

_Read `00-OVERVIEW.md`, the Stage 3 close-out in `PROJECT-STATUS.md`, `SPEC.md §3.1` (the macro view), `§3.2` (heartbeat), `§3.3` (honesty layer — what Stage 4 does NOT do yet), `§4` (aesthetic rule — the hard one), `§7.4` (snapshot schema), the `2026-06-04` entry for D1, D2, D6 in `DECISIONS.md`, and `src/lib/state/network.svelte.ts` before any code. Run this stage on the latest available Claude Opus. Stop-and-confirm at the Stage 4 boundary — do not start Stage 5._

## What this stage is

The marquee visual moment. The ~128 subnets of Bittensor light up in `<main>` as a living organism — cells, not nodes; a body, not a diagram. Stage 3 left `<main>` deliberately empty for this; Stage 4 fills it with the breathing field. **Honesty colouring is not in this stage** (Stage 5); the Yuma-epoch-locked pulse is not in this stage (Stage 5); births and deaths are not in this stage (Stage 5). Stage 4 ships the field chassis with one channel wired (intensity ← emissionShare), a baseline warm hue, an autonomous ambient breathe, and a clickable no-op stub per D1. Stage 5 then plugs the honesty signal and the epoch pulse into the same shader.

The success criterion is sensory: if a screenshot reads as "crypto network graph" or "dashboard heatmap," **the stage has failed.** It must read as physiological — bioluminescent, neural, deep-ocean. D2 is non-negotiable.

## Step 0 — Comprehension (before writing any code)

Read in this order:

1. `docs/handoff/00-OVERVIEW.md` — the seven D1–D7 decisions, especially **D2 (no node-link, hard aesthetic rule)** and **D1 (macro-first; clickable cell is a no-op stub, not the micro view)**.
2. `SPEC.md` — `§3.1` (what each cell encodes), `§3.2` (heartbeat — note that the chain-locked pulse is Stage 5, _not_ Stage 4), `§3.3.1` (the v1 signal — note that wiring it to colour is Stage 5), `§4` (the hard aesthetic guardrail), `§7.4` (schema — the fields Stage 4 actually reads), `§9` (engineering constraints).
3. `DECISIONS.md` — D2 (physiological register), D6 (portrait, not explorer — no orbit controls, no on-hover numbers), D1 (clickable stub only).
4. `src/lib/state/network.svelte.ts` — the store you read from. Do not modify its shape.
5. `src/lib/types/network.ts` — the `SubnetRow` fields available per cell.
6. `src/routes/+page.svelte` — the chassis Stage 3 left for you.
7. **BWI Pu-238 cube shader** in `~/Projects/bitcoinweighin` (referenced by D2). Skim the blackbody-glow approach — separated intensity and colour-temperature channels, additive blending, soft-disc fragment shader. You are reusing the technique, not the code.

Summarise back, in your own words: which fields per `SubnetRow` Stage 4 actually consumes (only `uid`, `name`, `emissionShare`); why `realRevenueSignal` / `signalSource` are deliberately ignored at this stage; how the shader's two channels split between Stage 4 (intensity wired, temperature pinned) and Stage 5 (temperature wired to the signal, pulse phase wired to the epoch); and what the failure mode is if any other field starts shaping the render in this stage.

Verify Three.js is installed and the version is sane before writing a line of code:

```sh
node -e "import('three').then(t => console.log('three', t.REVISION))"
```

It should print a revision number around 180. If not, **stop and reconcile** — do not bump or replace the dep without a DECISIONS entry.

## Step 1 — Positional layout (pure)

Create `src/lib/field/positions.ts` — a pure utility, no Three.js import. Given a `uid` and a configured `MAX_SUBNETS`, returns a stable `(x, y)` in a normalised `[-1, 1]` field square.

Use a **Vogel sunflower phyllotaxis** layout:

```
golden_angle = π × (3 − √5)
angle_i      = i × golden_angle
radius_i     = sqrt(i / MAX_SUBNETS) × R_field      // R_field ≈ 0.92 to leave a margin
x_i, y_i     = radius_i × (cos angle_i, sin angle_i)
```

Why this layout (the reasoning is load-bearing):

- **Not a grid.** Grids read as heatmaps. D2 fails.
- **Not a node-link.** No edges, period. D2 fails.
- **Not random.** Random scatter reads as noise, not a body.
- **Phyllotaxis is organic but deterministic.** Every uid has one position and only one position. A viewer who opens the page twice a day for a week builds spatial memory of the network. Subnet 0 (root) at the centre is a real semantic anchor — the network's origin point. New high-uid subnets ignite at the rim. That mapping is the field's identity.

Constraints on `positions.ts`:

- **Pure function.** No Three.js types, no DOM, no state. Inputs in, position out. Testable in isolation.
- **`MAX_SUBNETS = 256`** — the 256-cap expansion already lives in the layout per SPEC §6's "config value, not a magic number." Today only ~128 uids are lit; tomorrow the field grows naturally. Do not hardcode 128 anywhere.
- **Stable across cap changes.** If the layout depends on `MAX_SUBNETS`, document that bumping the constant will shift all positions — and that we accept that one-time discontinuity as part of the expansion event.
- **No collision check needed** — phyllotaxis is collision-free by construction at our densities.

Export the constant `MAX_SUBNETS` from this file too (or from a sibling `config.ts`); the renderer reads it.

## Step 2 — Shader (blackbody-glow disc, two channels)

`src/lib/field/shaders.ts` — exported `vertexShader` and `fragmentShader` strings. Built so Stage 5 plugs into the same shader without re-architecting.

**Per-instance attributes** the vertex shader expects:

- `aPosition` (vec2) — the field-space position from `positions.ts`.
- `aRadius` (float) — the cell's drawn radius, computed from `emissionShare` (Step 3).
- `aIntensity` (float) — 0..1 brightness multiplier. Stage 4 wires this from `emissionShare`; Stage 5 may modulate it.
- `aTemperature` (float) — 0..1 colour-temperature channel. **Stage 4 sets this to a constant 0.5** (warm amber baseline ≈ 3200 K-equivalent). Stage 5 wires it from `realRevenueSignal` — 0 = cold (deep teal, ~5500 K-equivalent), 1 = warm (amber, same as Stage 4 default).
- `aPhase` (float) — 0..2π, deterministic per uid (e.g., `(uid × 0.6180339) mod 1 × 2π`). Used by the ambient breathe so cells de-synchronise.
- `aAlive` (float) — 0 or 1. Stage 4: 1 if the snapshot contains this uid, 0 otherwise (slot dark). Stage 5 will animate this for birth/death.

**Vertex shader responsibilities:**

- Billboard the quad to face the camera (use the camera's modelView matrix; ortho camera makes this trivial).
- Scale by `aRadius × (1 + 0.12 × sin(uTime + aPhase))` — the ambient breathe. Amplitude small enough to feel like breathing, not throbbing.
- Pass UV, intensity, temperature, alive to fragment.

**Fragment shader responsibilities:**

- Soft disc: `disc = smoothstep(1.0, 0.92, length(vUv*2-1))` for the core, plus an outer halo: `halo = smoothstep(1.0, 0.0, length(vUv*2-1))` raised to a power for slow falloff. Sum them weighted.
- Colour from temperature: a 2-stop interpolation between **cold (deep teal-cyan, ~`#1e6f8a`)** and **warm (amber, ~`#f0bc76`)**. Do not implement a full Planckian blackbody curve — a 2-stop perceptual gradient through a neutral midpoint (a desaturated near-white at temperature=0.5) is more controllable and is what BWI Pu-238 effectively does.
- Final: `gl_FragColor = vec4(colour, 1.0) * intensity * (disc + halo × 0.4) × aAlive`.
- **Additive blending in JS** (set on the material). Use `THREE.AdditiveBlending`, `depthWrite: false`, `transparent: true`.

What the shader must **not** do:

- No lighting model. No Lambert, no Phong, no Standard material. The cells are sources of light, not surfaces lit by light.
- No texture sampling. The disc is procedural.
- No edges or lines drawn between cells. Ever.

## Step 3 — Field component

`src/lib/field/Field.svelte` — the Three.js mount. Browser-only.

Shape:

- Receives no props. Reads `networkStore` directly.
- Renders a single `<canvas>` (or lets Three create one and mounts it). The canvas is `width: 100%; height: 100%;` of its container; aspect-ratio handled by the camera.
- **Dynamic-imports Three.js inside `$effect`**: `const THREE = await import('three')`. Top-level static imports of `'three'` are fine because the SvelteKit build splits the bundle, but the SCENE construction must run only after the component is mounted and the canvas has a real bounding box. Do not run any `new THREE.*` inside module init.

Mount flow inside `$effect`:

1. Create renderer (`new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true })`), set device pixel ratio (`Math.min(window.devicePixelRatio, 2)` — guard against retina-density wastage).
2. Create scene + orthographic camera. Camera framing: `left = -aspect, right = aspect, top = 1, bottom = -1, near = -1, far = 1` (so field positions in `[-1, 1]` fit with a small margin). Aspect from the canvas's bounding rect, not `window.innerWidth`.
3. Create one billboard `PlaneGeometry(2, 2)` (a single quad, UVs cover the disc).
4. Create the `ShaderMaterial` from Step 2's strings, with uniforms `uTime` (float) and any constants you need.
5. Create `InstancedMesh(geometry, material, MAX_SUBNETS)`. Set instance attributes (`InstancedBufferAttribute`) for `aPosition`, `aRadius`, `aIntensity`, `aTemperature`, `aPhase`, `aAlive`. **All initialised to alive = 0** until data arrives.
6. Start a RAF loop: update `uTime`, call `renderer.render(scene, camera)`. **One draw call per frame** — that's the win of the instanced approach.
7. Add a `ResizeObserver` on the canvas's parent; on resize, update canvas size, renderer size, camera left/right.
8. Return a cleanup function from the effect: cancel RAF, disconnect observer, dispose geometry / material / renderer (`renderer.dispose()`, `geometry.dispose()`, `material.dispose()`). Memory leaks here will compound in HMR.

**Data wiring** — a second `$effect` (or the same one reading `networkStore.data` reactively):

- When `networkStore.data` becomes non-null, walk `data.subnets[]`. For each subnet:
  - Look up the position from `positions.ts` keyed on `subnet.uid` (not array index — uids may be non-contiguous when subnets have been deregistered).
  - Compute the drawn radius: `R_min + (R_max − R_min) × sqrt(min(emissionShare / EMISSION_REF, 1))` where `EMISSION_REF ≈ 0.15` (current top-share ceiling). Clamp; never NaN. If `emissionShare === null`, radius = `R_min`.
  - Compute intensity: `I_baseline + I_extra × sqrt(min(emissionShare / EMISSION_REF, 1))` — same shape as size; size and brightness reinforce each other. If `emissionShare === null`, intensity = `I_baseline`.
  - Set `aAlive = 1`, `aPhase = (uid × φ) mod 1 × 2π` (use a constant golden ratio).
  - `aTemperature = 0.65` everywhere for Stage 4 — a slightly warm baseline, the same warmth as the Stage 3 radial pulse. (Stage 5 changes this per cell.)
- For uids in `[0, MAX_SUBNETS)` _not_ present in the snapshot, set `aAlive = 0`. Their slot stays dark.
- After mutating instance attributes, set `instancedMesh.instanceMatrix.needsUpdate = true` (if using matrices) and each `instanceAttribute.needsUpdate = true`.

**Calibration starting points** (the executor should tune these by eye on the live snapshot):

| Constant       | Value   | Purpose                                           |
| -------------- | ------- | ------------------------------------------------- |
| `R_field`      | `0.92`  | Phyllotaxis radius; leaves 8% margin              |
| `R_min`        | `0.012` | Smallest visible cell (emissionShare = 0 or null) |
| `R_max`        | `0.042` | Largest cell at top emission share                |
| `I_baseline`   | `0.55`  | Brightness floor                                  |
| `I_extra`      | `0.45`  | Brightness extra at top share                     |
| `EMISSION_REF` | `0.15`  | Normalisation ceiling for sqrt scaling            |
| Breathe period | `~6 s`  | Per-cell autonomous oscillation                   |
| Breathe amp    | `0.12`  | Scale-modulation amplitude                        |

These are starting points, not gospel. The executor should preview against the live snapshot (top subnet currently ~`emissionShare ≈ 0.10`) and adjust so the field reads as "alive, varied, no single cell dominates."

**Hover / cursor:**

- On mouse-move, raycast against the InstancedMesh. If a cell is hit, set `canvas.style.cursor = 'pointer'`; else default.
- Do **not** show a number, name, or tooltip on hover. Hover is a cursor change only — anything more drifts toward dashboard.

**Click:**

- On click, raycast → get `instanceId` → map to `uid` → emit a `click` to `+page.svelte` (via a callback prop or a small event store). The tooltip lives outside the canvas (Step 4).
- If the raycast misses, dismiss any open tooltip.

**Reduced motion:**

- `matchMedia('(prefers-reduced-motion: reduce)')` — if matched, set breathe amplitude to 0 (cells render at their baseline radius, no oscillation). The RAF loop still runs to keep raycast/resize live; just no shader-time animation.

## Step 4 — Subnet tooltip (DOM overlay, no-op stub)

`src/lib/field/SubnetTooltip.svelte` — a small DOM element (not a Three.js sprite), absolutely positioned over the canvas, shown when the user clicks a cell.

Why DOM, not in-canvas:

- Real text means correct subpixel AA, font metrics, copy-paste, screen-reader accessibility, and CSS variables for free.
- Position computed once on click by projecting the cell's 3D position to screen pixels (`vector.project(camera)` → pixel coords). The tooltip then sits via `position: absolute; left/top`.

Content — strictly per D1:

```
Subnet {uid}{ · name when not null}
detail coming soon · Phase 2
```

Two lines, monospace, dim, same register as the telemetry strip. **No emission share. No alpha price. No market cap. No validator count.** Listing any of those collapses Stage 4 into a dashboard, violating D6. The conceptual hook D1 specifies is "subnet detail coming soon" — that is the entire payload.

Dismiss on: clicking outside the cell, pressing Esc, scrolling, or window resize. (Tying to resize avoids stale anchoring after the camera changes.)

Accessibility:

- The tooltip is a real DOM element with `role="dialog"`, `aria-modal="false"`, and an `aria-label` containing the same text.
- The canvas itself gets `aria-label="Network field of {totalSubnets} subnets"` updated as `networkStore.data` arrives. Below the canvas, a visually hidden `<p class="sr-only">` text node summarises the field for screen readers — e.g., "Bittensor network field, 129 subnets, source taostats, as of {asOf}." (The telemetry strip is the visible version; this is the assistive-tech version.) Full keyboard navigation between cells is **Stage 8's problem**, not Stage 4's — call this out in the commit message.

## Step 5 — Page wiring

In `src/routes/+page.svelte`:

- Replace the empty `<main aria-label="network field"></main>` with `<main><Field /></main>`. The `aria-label` moves onto the canvas inside `Field`.
- When `networkStore.data` is non-null, **dim the Stage 3 pulse**: add a class `data-loaded` on the `.page` container that drops `.pulse { opacity: 0.5 }` from its current value. During loading and unreachable states, the pulse stays at full opacity — the warm radial breathing is the only sign of life until the field can mount. Reactive class: `class:data-loaded={networkStore.data !== null}` (Svelte 5 syntax).
- Do **not** add a transition longer than ~600 ms on the pulse opacity. It should be a calm fade, not a curtain reveal.
- Keep the `$effect` that calls `refresh()` once on mount — Stage 4 does not change the data layer.

## Step 6 — Routes you do _not_ add

- No `/field`, no `/subnet/[uid]`, no modal route. The tooltip is a transient DOM element, not a route.
- No keyboard cell-traversal (Stage 8).
- No FPS overlay, no shader-inspector debug panel committed (a local dev toggle is fine — do not ship it).

## Step 7 — Visual and performance verification

Local first:

```sh
npm run build && npm run preview
```

Open the preview URL and confirm — _by eye, on the live snapshot served from jsDelivr_:

1. **The field is recognisably organic.** A naïve viewer should not be able to call it "a grid" or "a network diagram." If it reads that way, the layout, the colour, or the additive blending is wrong. Stop and fix before pushing.
2. **Subnet 0 sits at the centre.** Subnet 1 nearby. New high-uid subnets at the rim. Confirm by clicking a few cells.
3. **Size varies legibly.** The top-emission cells are visibly larger and brighter than the cold tail. The cold tail is still visible — not a sea of black with three bright dots.
4. **Cells breathe.** Each cell oscillates independently; the field doesn't pulse in unison (that's Stage 5's job).
5. **Click opens the stub.** Clicks elsewhere / Esc dismisses. The stub shows uid + name + "detail coming soon"; nothing else.
6. **Hover changes cursor to pointer over cells.** No numbers appear.
7. **Telemetry strip still reads correctly.** The Stage 3 `NetworkStatus` line should still surface fresh / stale / loading / unreachable identically. Field code must not regress the strip.
8. **Mobile viewport** (devtools, 390 × 844). Field re-renders to fill, cells stay legible, header/footer compress sensibly. No horizontal scroll.
9. **Reduced motion**: in devtools, emulate `prefers-reduced-motion: reduce`. Confirm breathe stops; field is static but rendered.

Performance verification:

- DevTools Performance: 60 fps steady on a typical laptop, no GC sawtooth, no main-thread spike on resize.
- Memory: heap snapshot before mount, after mount, after 30 s of RAF. No unbounded growth.
- One draw call per frame for the field (verify in `spector.js` or the Three.js inspector if available; otherwise count the renderer's `info.render.calls` after a render).

Then push to `main` and wait for Cloudflare Pages to deploy. Open the `.pages.dev` URL and confirm the same on staging.

## Step 8 — Update SPEC, README, PROJECT-STATUS

- `SPEC.md` — extend `§3.1` with a paragraph documenting the phyllotaxis-by-uid layout, the `MAX_SUBNETS = 256` config, and the size = sqrt(emissionShare) encoding as the v1 commitment. Add a brief note that the cold-warm temperature axis is wired but pinned to a single warm value in Stage 4; Stage 5 wires it to `realRevenueSignal`. Update `§10` to mark Stage 4 complete.
- `README.md` — add a "Field" sub-section under the data layer documenting the Three.js mount, the position/shader split, the `MAX_SUBNETS` constant, and the deliberate decision that no honesty colouring is wired yet.
- `PROJECT-STATUS.md` — flip Stage 4 to "complete and deployed"; note the `.pages.dev` URL with the live field visible; record any calibration constants the executor settled on (R_min / R_max / EMISSION_REF) so Stage 5 doesn't have to re-derive them; preview the Stage 5 prompt that's coming next.

## Step 9 — Commit, push, report, stop

- Small logical commits on `main`: positions util, shaders, Field component, SubnetTooltip, page wiring, docs. Conventional messages (`feat: …`, `docs: …`).
- Push, confirm with `git log origin/main --oneline -10`.
- Report: the live `.pages.dev` URL with the field rendered; the verification checklist outcomes; calibration constants you settled on; any aesthetic surprises that surfaced (cells too bright, cold tail invisible, etc.) and how you resolved them. Then **STOP**. Do not begin Stage 5.

## Out of scope for this stage (do not build)

- **Honesty colouring** — wiring `realRevenueSignal` / `signalSource` to per-cell temperature. The shader exposes the channel; this stage leaves it pinned to a warm constant. Stage 5.
- **Yuma-epoch-locked pulse** — a synchronized swell on epoch boundaries. The ambient per-cell breathe is decoupled from chain time on purpose. Stage 5.
- **Birth / death animations** — registration ignitions and deregistration deaths. The schema already carries `events.registrations` / `events.deregistrations`; Stage 4 does not read them. Stage 5.
- **The micro view** — diving into a single subnet's weight matrix. The click stub is the conceptual hook; building any matrix machinery is Phase 2.
- **Time-lapse / scrubber / sonification.** Stage 7.
- **The delegate panel.** Stage 6.
- **Full keyboard navigation between cells.** Stage 8.
- **Schema changes.** If the field "needs" a field that isn't in §7.4, **stop and update the schema first.** Do not deserialize an undocumented field from `network.json`.
- **react-three-fiber, Threlte, or any Three.js framework shim.** Raw Three.js is the brief — keep the dep surface small.
- **Orbit controls, zoom controls, pan controls, "view from above," camera bookmarks.** D6 forbids the operator register. The field is a portrait — the viewer cannot reframe it.
- **Per-cell tooltips on hover with numbers.** Click → stub is the entire interactive payload. Hover is cursor-only.

If a step here feels like it requires any of the above to "look complete," that's the signal to stop and surface — Stage 4 is the chassis with one channel wired, and Stage 5 plugs in the rest.

## Constraints

- **D2 aesthetic rule — non-negotiable.** Phyllotaxis-by-uid, additive blackbody glow, soft disc with halo, no edges, no grid, no lighting. A screenshot that reads as a network diagram or a dashboard heatmap is a stage failure, regardless of how much code shipped.
- **D1 macro-first.** Click opens the no-op stub. Nothing else. The micro view is Phase 2; do not build any of it.
- **D4 honesty.** Null `emissionShare` renders at `R_min` with the baseline neutral intensity — never a fabricated non-zero value. Absent uids are dark slots, not faked cells.
- **D6 portrait, not explorer.** No camera controls. No on-hover numbers. No FPS overlay or shader inspector committed. The viewer watches; they do not operate.
- **Schema is the contract.** Only `uid`, `name`, `emissionShare` are read this stage. Do not silently consume `realRevenueSignal` or `signalSource` here — that drift is exactly what Stage 5 is for, and skipping the stage boundary will compound into a colour scheme that has not been spec'd.
- **Single-route, single-canvas.** The tooltip is a transient overlay, not a route. No `/field`, no `/subnet/[uid]`.
- **MAX_SUBNETS = 256 in config, not 128 in code.** Today only ~128 uids light; the layout is sized for the cap. SPEC §6's "config value, not a magic number" applies here.
- **No new heavy deps.** Three.js is already present. Adding react-three-fiber / Threlte / postprocessing libraries is out of scope and requires a DECISIONS entry first.
- **Pulse stays the loading register.** During loading / unreachable, the Stage 3 warm radial pulse stays full-opacity — that's the honest "alive but no data" state. Dimming happens only when `networkStore.data` arrives.
- **Browser-only Three.js.** No Three.js import or construction at module init. The SSR-prerendered HTML must be identical to Stage 3 (header, empty `<main>`, footer with `as of —`); the field appears on hydration.
- **One draw call per frame.** If Stage 4 ships with more than one draw call for the field, something is wrong with the instancing — surface it before pushing.
- **"Done" requires browser verification.** Local `npm run preview` is necessary but not sufficient. Stage 4 closes only when the live `.pages.dev` URL shows the field rendered from real jsDelivr data, the verification checklist passes, and the commits are on `origin/main`.
- **Small commits, conventional messages.** `feat: …`, `docs: …`. One logical unit per commit.
