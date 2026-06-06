# Stage 3 — Scaffold

_Read `00-OVERVIEW.md`, the Stage 2 close-out in `PROJECT-STATUS.md`, `SPEC.md §3.1` (macro view), `§7.4` (snapshot schema), `§4` (aesthetic rule), and the `2026-06-06` entries in `DECISIONS.md` before any code. Run this stage on the latest available Claude Opus. Stop-and-confirm at the Stage 3 boundary — do not start Stage 4._

## What this stage is

The chassis. The browser fetches the live snapshot from jsDelivr for the first time and the holding page's "as of —" stamp becomes real. **No Three.js field, no cells, no honesty colour wired to a render target.** Stage 3 is the deliberately empty room the field walks into in Stage 4 — header, footer, attribution, a small honest telemetry strip — plus the data layer (state store, fetcher, types) it'll plug into.

Why "scaffold" if Stage 1 already shipped a SvelteKit scaffold: Stage 1's scaffold was build-only (prove the deploy path). Stage 3's scaffold is **components-first** — the first reusable Svelte components, the first browser→jsDelivr round-trip, the first visual verification on the live `.pages.dev` URL with real data on the page. The "overlap with Stage 1" reconcile note from earlier sessions is closed.

## Step 0 — Comprehension (before writing any code)

Read in this order:

1. `docs/handoff/00-OVERVIEW.md` — concept + the seven D1–D7 decisions, especially **D2 (no node-link graph, hard aesthetic rule)** and **D4 (honesty layer is mandatory)**.
2. `SPEC.md` — `§3.1` (the macro view, what each cell encodes), `§3.3` (honesty layer), `§4` (aesthetic rule), `§7.4` (snapshot schema you'll be reading from JS), `§9` (engineering constraints).
3. `DECISIONS.md` — the `2026-06-06` entries (D8 cadence, D9 two-branch + jsDelivr, D10 Subtensor fallback). You need to know why the data URL lives where it does.
4. `src/lib/data-source.ts` — the jsDelivr URL constants Stage 2 placed there for you to consume.
5. `src/routes/+page.svelte` — the current holding page (warm radial pulse, "as of —" stamp). Stage 3 evolves this without breaking the aesthetic.
6. `scripts/snapshot-types.ts` and `static/network.schema.json` — the shape you're about to deserialise. The schema is the contract.

Then verify the live data is reachable before writing a line of code:

```sh
curl -sf https://cdn.jsdelivr.net/gh/hmgovt/metagraphs@data/static/network.json | jq '{schemaVersion, asOf, epoch, block, stale, source, totalSubnets}'
```

It should return valid JSON matching `network.schema.json`. If not, **do not proceed** — fix the Stage 2 pipeline first.

Summarise back, in your own words: what fields the browser reads (and which are explicitly nullable per §7.4); what the four states the telemetry strip must surface honestly are (fresh-and-good, stale, loading, unreachable); and what is explicitly **not** in this stage (the Three.js field, cell rendering, the §3.3.1 colour mapping, the scrubber, the delegate panel).

## Step 1 — Browser-side types

Create `src/lib/types/network.ts` — the canonical browser-facing TypeScript types for the §7.4 schema. Mirror `scripts/snapshot-types.ts` shape (`SubnetRow`, `SnapshotRow`) and extend it with `NetworkJson` (the pivoted file with `events`). Add a short module-level comment that the schema in `static/network.schema.json` is the contract and these types must move in lock-step with it.

Do **not** re-export from `scripts/` — that crosses the Node/browser boundary; the types are short enough to mirror cleanly.

## Step 2 — Network state store

`src/lib/state/network.svelte.ts` — a Svelte 5 runes-based state module that owns the snapshot lifecycle.

Shape:

- `data: NetworkJson | null` — the latest successfully parsed snapshot, or null before first fetch.
- `meta: NetworkMeta | null` — the latest `network-meta.json` (use the corresponding URL constant).
- `loading: boolean`, `error: Error | null`, `lastFetchedAt: Date | null`.
- A `refresh()` function that triggers a fetch on demand.
- Behaviour: on first mount, fetch both `NETWORK_JSON_URL` and `NETWORK_META_URL`. On parse failure, set `error` and leave `data` null. On schema-shape mismatch (e.g. `schemaVersion !== 1`), set `error` with a clear message rather than rendering a malformed object.
- A simple background refresh loop: re-fetch every 5 minutes. (Reason: jsDelivr's TTL is ~10 min and the cron commits every 10 min, so 5 min keeps the page within one epoch of fresh. The visual heartbeat — pulse on epoch boundaries — is a Stage 5 concern; do not tie the fetch cadence to it here.)
- Browser-only — `if (typeof window === 'undefined') return` early-out so SSR prerendering doesn't try to fetch. The first paint on the static page is the empty state; hydration drives the live fetch.

Architecturally: this is the single source of truth Stage 4 will read for cell counts and Stage 5 will read for the signal-per-cell colour input. Don't bake field-rendering concerns into the store yet, but leave it shaped so they can plug in.

## Step 3 — Components

Three small components under `src/lib/components/`:

- **`SiteHeader.svelte`** — wordmark + one-line descriptor. Same content as the Stage 1 holding page, hoisted into a header element. Keep the visual weight light (wordmark `clamp(...)`-sized, descriptor `max-width: 36ch`). The header sits above the field-mount slot.
- **`NetworkStatus.svelte`** — a single honest line of telemetry, monospace, dim, footer-adjacent. Reads from the store. Format:
  - When `data` is present and fresh: `as of {asOf, formatted} · epoch {epoch} · {totalSubnets} subnets · source {source}`
  - When `data.stale === true`: prefix with a dim `stale ·` marker. Do not hide the rest — the user should see the stamp they're looking at _is_ stale.
  - When `loading && !data`: `as of —` (mirror the Stage 1 placeholder; same baseline).
  - When `error && !data`: `as of —` plus a tiny `· data unreachable` suffix, dimmer than the timestamp. **No toast, no spinner, no error icon.** Per D4 we surface the absence honestly without dramatising it.
  - Format `asOf` as `YYYY-MM-DD HH:MM UTC` (kill the seconds and milliseconds — the chain doesn't tick at that resolution).
- **`SiteFooter.svelte`** — small attribution line: link to the `data` branch (`https://github.com/hmgovt/metagraphs/tree/data`), a sentence on the snapshot cadence ("snapshot per Yuma epoch · ~72 min · via Taostats and Subtensor"), and a link to the SPEC / DECISIONS via the repo. Keep the same dim treatment as `NetworkStatus`.

## Step 4 — Page chassis

Re-shape `src/routes/+page.svelte` into a header / main / footer chassis:

- `<SiteHeader />` at the top.
- A `<main>` region that is the future home of the field — **deliberately empty in Stage 3**, but sized and styled so dropping a Three.js canvas into it in Stage 4 is a no-op. Keep the warm radial pulse from Stage 1; move it behind the `<main>` region so it reads as ambient breathing under the (currently absent) cells rather than backdrop for a wordmark.
- A `<footer>` region housing `<NetworkStatus />` (top) and `<SiteFooter />` (bottom).
- Mount the store on first render: a top-level `$effect` (or equivalent) that calls `refresh()` once on mount. The interval polling is set up inside the store, not the page.

Constraints:

- **Aesthetic rule (D2).** No grid of placeholder cells, no node-link teaser, no dotted-circle "loading" pattern. The empty `<main>` is empty. The pulse and the dim type sell the register.
- **Mobile.** Header / footer compress sensibly on narrow viewports; the pulse stays centred. Don't add a hamburger or any chrome — we don't have routes to navigate.
- **Reduced motion.** Keep the existing `prefers-reduced-motion: reduce` carve-out on the pulse.

## Step 5 — Routes you do _not_ add

- No `/data`, no `/about`, no `/api`. Stage 3 is single-route.
- No clickable cell handler (Stage 4 will add one as a no-op stub per §3.1 / D1).
- No delegate panel link (Stage 6).

## Step 6 — Visual verification on staging

Local first:

```sh
npm run build && npm run preview
```

Open the preview URL, confirm `NetworkStatus` populates from the live jsDelivr data within ~1 s. Confirm the warm pulse still reads on-brand under the new chassis. Open devtools network tab and confirm only `network.json` and `network-meta.json` are fetched — no other URLs, no analytics, no font CDNs.

Then push to `main` and wait for Cloudflare Pages to deploy. Open the `.pages.dev` URL and confirm the same on staging.

Manually verify the four telemetry states:

1. **Fresh** — the default after a recent cron run.
2. **Stale** — temporarily edit the local `static/network.json` to flip `stale: true`, rebuild, preview. Confirm the `stale ·` prefix appears. Revert the edit, do not commit.
3. **Loading** — throttle network in devtools, hard-reload. Confirm `as of —` is the first paint.
4. **Unreachable** — block `cdn.jsdelivr.net` in devtools, reload. Confirm `as of — · data unreachable` renders without a toast, error overlay, or console spam.

## Step 7 — Update SPEC, README, PROJECT-STATUS

- `SPEC.md` — extend `§3.1` (or add a new `§3.6`) with a one-paragraph note on the telemetry strip: it is a load-bearing component of the honesty contract (D4), not chrome. Update the `§10` stage table row for Stage 3 to "complete."
- `README.md` — add a "Data layer" sub-section under the snapshot pipeline section documenting `src/lib/state/network.svelte.ts` and the 5-min refresh cadence.
- `PROJECT-STATUS.md` — flip Stage 3 to "complete and deployed"; note the `.pages.dev` URL with live telemetry visible; preview the Stage 4 prompt that's coming next.

## Step 8 — Commit, push, report, stop

- Small logical commits on `main`: types, store, each component, page wiring, docs. Conventional messages (`feat: …`, `docs: …`).
- Push, confirm with `git log origin/main --oneline -8`.
- Report: the live `.pages.dev` URL with the telemetry showing real `asOf` and `epoch`; the four states verified; what's deliberately empty in `<main>`. Then **STOP**. Do not begin Stage 4.

## Out of scope for this stage (do not build)

- The Three.js breathing field (Stage 4).
- Any per-subnet cell rendering, including a CSS-only preview grid.
- Wiring `realRevenueSignal` / `signalSource` to colour, intensity, or any pixel (Stage 5).
- The delegate panel (Stage 6).
- Time-lapse / scrubber / sonification (Stage 7).
- Subnet detail routes, modal stubs, or a "subnet detail coming soon" handler (a Stage 4 follow-up on the clickable-cell hook).
- Schema changes. If the renderer wants a field that isn't in §7.4, **stop and update the spec first**, then come back.

If a step here feels like it requires any of the above to "look complete," that's the signal to stop and surface — Stage 3's deliberate emptiness is itself the deliverable, just like Stage 1's was.

## Constraints

- **D2 aesthetic rule.** No placeholder cells, no node-link teaser, no glowing-blue-dots-and-lines. An empty `<main>` is correct.
- **D4 honesty.** Stale and unreachable are labelled, not hidden. `as of —` is the correct empty/loading state; never a fabricated timestamp.
- **No keys reach the browser.** Re-confirm by grepping the build output (`grep -r TAOSTATS_API_KEY build/` should return nothing). The store fetches from jsDelivr, which serves the already-redacted public files.
- **Schema is the contract.** Browser types in `src/lib/types/network.ts` must match `static/network.schema.json`. If they drift, the schema wins — fix the types, not the schema.
- **Single-route.** Resist any "while we're in here" urge to add `/data`, `/about`, or a sitemap. v1 is the macro view, period.
- **"Done" requires browser verification.** Local `npm run preview` is necessary but not sufficient. The stage closes only when the live `.pages.dev` URL shows real `asOf` + `epoch` + `totalSubnets` from jsDelivr-served snapshot data, the four telemetry states have been visually confirmed, and the commits are on `origin/main`.
- **Small commits, conventional messages.** `feat: …`, `docs: …`. One logical unit per commit.
