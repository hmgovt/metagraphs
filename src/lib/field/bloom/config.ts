/**
 * Calibration knobs for the bloom (SPEC §3.9, brief `docs/handoff/05-bloom.md`).
 *
 * Tune these by eye against real data, not by formula. The lifecycle
 * timings should feel cinematic on a hover-and-watch viewer; the field
 * deformation gains should make Subnet 64 (dominant emitter) bend
 * neighbours' filaments visibly without making them snap. Tune at the
 * dev server with one bright cell and one cold cell hovered in turn.
 */

// --- Mode threshold ---

/** Below this `camera.zoom`, hovering triggers the full 8-filament cascade. */
export const CASCADE_THRESHOLD = 2.0;

// --- Lifecycle phase durations (ms) ---

export const IGNITION_MS = 150;
export const ERUPTION_MS = 650;
export const APEX_MS = 400;
export const COOLING_MS = 1000;
export const DECAY_MS = 600;

/** Stagger between segment ignitions in cascade mode. */
export const CASCADE_STAGGER_MS = 90;

/** Fade-in delay for terminal text within the cooling phase (ms after eruption ends). */
export const TERMINAL_FADE_DELAY_MS = 500;
export const TERMINAL_FADE_DURATION_MS = 500;

// --- Performance ---

/** FIFO-decay any older filament past this count globally. */
export const MAX_ACTIVE_FILAMENTS = 32;

// --- Ribbon geometry ---

export const RIBBON_HALF_WIDTH_FIELD = 0.004;
export const RIBBON_SAMPLES = 32;

// --- Twist ---

export const TWIST_AMP_BASE = 0.06;
export const TWIST_FREQ_MIN = 4;
export const TWIST_FREQ_MAX = 12;
/** Cells older than this read as stately; newer reads as frantic. */
export const AGE_STIFFNESS_DAYS = 30;

// --- Plasma colour stops ---

export const C_WHITE: readonly [number, number, number] = [1.0, 0.95, 0.9];
export const C_CYAN: readonly [number, number, number] = [0.55, 0.92, 1.0];
export const C_AMBER: readonly [number, number, number] = [1.0, 0.65, 0.25];
export const C_RED: readonly [number, number, number] = [0.55, 0.1, 0.05];

// --- Field deformation gains ---

/** How much the emission-field gradient bends the filament terminus. */
export const LENSING_GAIN = 0.22;
/** Max bloom-orientation rotation from $tao flow direction (radians). */
export const TAO_ROTATION_MAX = (15 * Math.PI) / 180;

// --- Cell-side effects during bloom ---

export const BLOOM_BRIGHTNESS_BOOST = 0.3;
export const BLOOM_BRIGHTNESS_RAMP_MS = 200;

// --- Filament length drivers ---
//
// Field space is [-1, 1]; the field circle has R_FIELD ≈ 0.96. Filament
// lengths control the radial standoff of the terminal text from the cell,
// so they need to be large enough that 8 terminals (each up to ~150 px
// wide) fan out around the cell without overlapping. With 8 segments at
// 45° apart, a minimum length of ~0.30 (≈ 135 px at a 900-px-tall viewport)
// gives ~100 px of angular separation between adjacent terminal centres —
// enough headroom once per-quadrant terminal alignment is applied.

export const EMISSION_FILAMENT_BASE = 0.30;
export const EMISSION_FILAMENT_SCALE = 0.30;
export const AGE_FILAMENT_BASE = 0.30;
export const AGE_FILAMENT_SCALE = 0.18;
export const TREND_FILAMENT_BASE = 0.30;
export const TREND_FILAMENT_SCALE = 15.0; // amplifies small share-deltas
export const CONSTANT_FILAMENT_LENGTH = 0.36;

/** Cells whose surface a filament emerges from get pushed outward by this offset. */
export const FILAMENT_FOOTPOINT_OFFSET = 0.01;

// --- Sigils (Mode B per-segment hover targets) ---

/** Pixel diameter of each sigil at screen scale. */
export const SIGIL_DIAMETER_PX = 14;
/**
 * Field-space radius the sigil orbits at. Fixed (not cell-radius
 * proportional) so the sigils are evenly fanned around every cell,
 * regardless of emission share. 0.10 ≈ 45 px at default zoom — well
 * outside any cell's visible radius.
 */
export const SIGIL_ORBIT_FIELD = 0.10;
export const SIGIL_FADE_MS = 300;

// --- Honesty noise on the ribbon fragment ---

/** When realRevenueSignal is null we treat the cell as neutral noise; this is the floor. */
export const NOISE_FLOOR = 0.05;
/** Maximum flicker amplitude on the ribbon brightness for a fully cold cell. */
export const NOISE_AMPLITUDE_MAX = 0.45;
