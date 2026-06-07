/**
 * Phyllotaxis-by-uid layout (SPEC §3.1, Stage 4 prompt Step 1).
 *
 * Each subnet uid maps to one and only one (x, y) in normalised field space
 * `[-1, 1]`. Subnet 0 (root) sits at the centre; new high-uid subnets ignite
 * at the rim. The mapping is uid → position (NOT array-index → position),
 * because uids are stable identifiers across snapshots while array indices
 * shift when subnets are deregistered.
 *
 * Pure module — no Three.js, no DOM, no state. Safe to import from anywhere.
 */

import { MAX_SUBNETS, R_FIELD } from './config';

export const GOLDEN_ANGLE = Math.PI * (3 - Math.sqrt(5));

/**
 * Vogel sunflower phyllotaxis.
 *
 *   angle  = uid × golden_angle
 *   radius = √(uid / MAX_SUBNETS) × R_field
 *
 * Bumping `MAX_SUBNETS` (e.g. for the 256-cap expansion) shifts every
 * position. We accept that one-time discontinuity as the cost of avoiding
 * the daily re-scatter that a rank-based layout would cause.
 */
export function positionForUid(
	uid: number,
	max: number = MAX_SUBNETS,
	rField: number = R_FIELD
): [number, number] {
	if (uid < 0 || uid >= max || !Number.isFinite(uid)) {
		return [0, 0];
	}
	const radius = Math.sqrt(uid / max) * rField;
	const angle = uid * GOLDEN_ANGLE;
	return [Math.cos(angle) * radius, Math.sin(angle) * radius];
}
