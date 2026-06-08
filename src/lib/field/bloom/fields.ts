/**
 * The four physical fields the bloom inhabits (SPEC §3.9).
 *
 * All four are pure functions of cell state — no DOM, no Three.js, no
 * mutable state. Computed once per filament at ignition, then frozen.
 *
 * Indices are by uid throughout. A "cell" here is the minimal shape
 * physics.ts needs — see CellSnapshot below — not the full SubnetRow.
 * This keeps the field math testable without the snapshot pipeline.
 */

import { TAO_ROTATION_MAX } from './config';

/**
 * Minimal cell snapshot. The bloom physics doesn't need the full
 * SubnetRow — just enough state to compute the four fields.
 */
export interface CellSnapshot {
	uid: number;
	x: number; // field-space x ∈ [-1, 1]
	y: number;
	alive: 0 | 1;
	emissionShare: number; // 0..1; 0 when dead
	realRevenueSignal: number | null; // 0..1 or null
	daysSinceRegistration: number | null;
	emissionShareDelta24h: number | null;
	realRevenueSignalDelta24h: number | null;
}

// --- Field 1: Emission field E ---

/** Newtonian-style 1/r² softening to avoid singularities at cell centres. */
const EMISSION_EPSILON_SQ = 0.01;

/**
 * Scalar emission potential at a field point p, summed over all live
 * cells. Higher near big emitters; near zero in empty regions.
 */
export function emissionPotential(p: { x: number; y: number }, cells: readonly CellSnapshot[]): number {
	let sum = 0;
	for (const c of cells) {
		if (c.alive === 0 || c.emissionShare <= 0) continue;
		const dx = p.x - c.x;
		const dy = p.y - c.y;
		sum += c.emissionShare / (dx * dx + dy * dy + EMISSION_EPSILON_SQ);
	}
	return sum;
}

/**
 * Gradient of the emission field at p — a 2D vector pointing toward
 * the strongest neighbouring emitter. Sampled once per filament at
 * ignition; the filament's terminus bends in the gradient direction
 * scaled by LENSING_GAIN (physics.ts handles the bend).
 *
 * Self-contribution is included on purpose: a cell sitting next to a
 * vastly larger emitter sees a strong outward gradient; a dominant cell
 * sees roughly zero (its own field swamps the neighbour). That's the
 * desired economic-lensing visual.
 */
export function emissionGradient(
	p: { x: number; y: number },
	cells: readonly CellSnapshot[]
): { x: number; y: number } {
	let gx = 0;
	let gy = 0;
	for (const c of cells) {
		if (c.alive === 0 || c.emissionShare <= 0) continue;
		const dx = p.x - c.x;
		const dy = p.y - c.y;
		const r2 = dx * dx + dy * dy + EMISSION_EPSILON_SQ;
		// d/dx of (e / r²) = -2 e dx / r⁴, etc. The gradient of the
		// potential points from c outward in the direction of dx, dy
		// — for a *filament* originating at the cell, that's away from
		// the cell. To bend a filament *toward* the strongest emitter
		// nearby, we want the negative gradient.
		const k = (-2 * c.emissionShare) / (r2 * r2);
		gx += k * dx;
		gy += k * dy;
	}
	return { x: gx, y: gy };
}

// --- Field 2: Honesty field H ---

/**
 * Per-cell honesty signal in [0, 1]. Null is treated as 0.5 (the §3.3
 * labelled neutral state) so the cooling profile reads "neutral, not
 * suspicious." Bloom shader receives this as the curve parameter for
 * the plasma cooling.
 */
export function honestyAt(cell: CellSnapshot): number {
	const s = cell.realRevenueSignal;
	if (s === null || s === undefined || !Number.isFinite(s)) return 0.5;
	return Math.max(0, Math.min(1, s));
}

// --- Field 3: Time field T ---

/**
 * Per-cell age in days. Null is treated as 0 (i.e. effectively new) so
 * the filaments read as frantic — that's an honest read of "we don't
 * know how long this has been here."
 */
export function ageDaysAt(cell: CellSnapshot): number {
	const d = cell.daysSinceRegistration;
	if (d === null || d === undefined || !Number.isFinite(d) || d < 0) return 0;
	return d;
}

// --- Field 4: $tao field Φ ---

/**
 * Per-cell directional vector representing 24 h net $tao flow.
 *
 * Definition (SPEC §3.9): magnitude scales with the cell's recent share
 * of the emission stream's growth/shrinkage; direction points from the
 * cell toward the emission-weighted field centroid when the cell is a
 * *net earner*, and away from the centroid when the cell is a *net
 * drainer*.
 *
 * v1 implementation uses emissionShareDelta24h as the proxy for
 * "earning vs draining" — a positive delta means the cell is taking
 * a larger share than 24 h ago (earning); a negative delta means it's
 * losing share (draining). The "$tao actually changing hands" view
 * lands properly in Stage 7 when we have per-subnet revenue numbers
 * from the alpha pools.
 *
 * Returns a 2D vector; physics.ts converts it into a bloom-orientation
 * rotation capped at TAO_ROTATION_MAX.
 */
export function taoFlowAt(cell: CellSnapshot, cells: readonly CellSnapshot[]): { x: number; y: number } {
	const delta = cell.emissionShareDelta24h;
	if (delta === null || delta === undefined || !Number.isFinite(delta) || delta === 0) {
		return { x: 0, y: 0 };
	}

	// Emission-weighted centroid.
	let cx = 0;
	let cy = 0;
	let w = 0;
	for (const c of cells) {
		if (c.alive === 0 || c.emissionShare <= 0) continue;
		cx += c.x * c.emissionShare;
		cy += c.y * c.emissionShare;
		w += c.emissionShare;
	}
	if (w === 0) return { x: 0, y: 0 };
	cx /= w;
	cy /= w;

	const dx = cx - cell.x;
	const dy = cy - cell.y;
	const len = Math.sqrt(dx * dx + dy * dy);
	if (len < 1e-6) return { x: 0, y: 0 };

	// Earners (+delta) point toward centroid; drainers (−delta) point away.
	const sign = delta > 0 ? 1 : -1;
	const mag = Math.min(1, Math.abs(delta) * 100); // amplify small share-deltas into a 0..1 magnitude
	return {
		x: (sign * mag * dx) / len,
		y: (sign * mag * dy) / len
	};
}

/**
 * Convert a $tao flow vector into a rotation angle in radians, capped
 * at TAO_ROTATION_MAX. The rotation is applied to the *entire bloom* —
 * all 8 filaments rotate by this much around the cell — so a net-earner
 * vs net-drainer bloom is visibly different even when emission share
 * is identical.
 */
export function taoRotationFromFlow(flow: { x: number; y: number }): number {
	const mag = Math.sqrt(flow.x * flow.x + flow.y * flow.y);
	if (mag < 1e-6) return 0;
	// Use the angle of the flow vector relative to "up" (0 radians per
	// the SEGMENTS convention) but clamp the influence to TAO_ROTATION_MAX.
	const direction = Math.atan2(flow.x, -flow.y); // 0 = up, clockwise positive
	return Math.max(-TAO_ROTATION_MAX, Math.min(TAO_ROTATION_MAX, direction * mag));
}
