/**
 * Field calibration constants.
 *
 * These are the v1 starting points called out in `docs/handoff/04-field.md`.
 * Bumping any of them shifts the field's read; do not change without eyeing
 * the live snapshot. `MAX_SUBNETS` is the SPEC §6 "config value, not a magic
 * number" — bumping it to 256 is the expansion event, not a refactor.
 */

export const MAX_SUBNETS = 256;

export const R_FIELD = 0.92;
export const R_MIN = 0.022;
export const R_MAX = 0.075;
export const EMISSION_REF = 0.12;

export const INTENSITY_BASELINE = 0.85;
export const INTENSITY_EXTRA = 0.6;

export const BREATHE_PERIOD_SEC = 6.0;
export const BREATHE_AMPLITUDE = 0.12;

export const TEMP_STAGE4_DEFAULT = 0.65;

export const PHI = 0.6180339887498949;

export const HIT_RADIUS_MULTIPLIER = 1.4;
export const HIT_RADIUS_FLOOR = 0.025;
