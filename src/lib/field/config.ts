/**
 * Field calibration constants.
 *
 * Tuned against the live snapshot at hero-scale (full viewport).
 * `MAX_SUBNETS` is the SPEC §6 "config value, not a magic number"
 * — bumping it to 256 is the expansion event, not a refactor.
 *
 * The 2026-06-07 hero-scale revision (D11 / D12 expansion):
 * field fills the viewport, cells are 2-3× bigger, honesty colour
 * lands at Stage 4 so the cold tail reads as cold from first paint.
 */

export const MAX_SUBNETS = 256;

export const R_FIELD = 0.96;
export const R_MIN = 0.03;
export const R_MAX = 0.115;
export const EMISSION_REF = 0.12;

export const INTENSITY_BASELINE = 0.85;
export const INTENSITY_EXTRA = 0.7;

export const BREATHE_PERIOD_SEC = 6.0;
export const BREATHE_AMPLITUDE = 0.12;

/**
 * Neutral midpoint temperature used when `realRevenueSignal` is null
 * (i.e. data missing per §3.3 — the cell renders mid, not warm).
 */
export const TEMPERATURE_NEUTRAL = 0.5;

export const PHI = 0.6180339887498949;

export const HIT_RADIUS_MULTIPLIER = 1.4;
export const HIT_RADIUS_FLOOR = 0.03;

/**
 * Microscope zoom (D12). Bounded so the viewer can lean in but never
 * loses the organism. MIN_ZOOM = 1 frames the whole field; MAX_ZOOM
 * frames roughly 4-5 cells across the viewport.
 */
export const MIN_ZOOM = 1;
export const MAX_ZOOM = 5.5;
export const ZOOM_STEP = 1.12;
export const NAME_LABEL_ZOOM_THRESHOLD = 2.4;
export const ZOOM_TWEEN_MS = 600;
