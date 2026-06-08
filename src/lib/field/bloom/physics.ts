/**
 * One-shot filament path computation at ignition (SPEC §3.9).
 *
 * Pure function — given a cell, a segment, and the surrounding cells,
 * return a cubic Bezier with four control points plus the helical twist
 * parameters baked in. Per-frame animation only advances the moving
 * front, plasma cooling, and twist phase; the path itself does not
 * re-solve. This is the budget discipline that lets 32 filaments
 * coexist without breaking frame.
 */

import type { CellSnapshot } from './fields';
import type { SegmentDef } from './segments';
import {
	LENSING_GAIN,
	TWIST_FREQ_MIN,
	TWIST_FREQ_MAX,
	TWIST_AMP_BASE,
	AGE_STIFFNESS_DAYS,
	FILAMENT_FOOTPOINT_OFFSET
} from './config';
import { emissionGradient, taoFlowAt, taoRotationFromFlow, honestyAt, ageDaysAt } from './fields';

export interface FilamentPath {
	/** Cubic Bezier control points, field-space coordinates. */
	p0: { x: number; y: number };
	p1: { x: number; y: number };
	p2: { x: number; y: number };
	p3: { x: number; y: number };
	/** Helical twist frequency along the ribbon (cycles along the path). */
	twistFreq: number;
	/** Helical twist amplitude (perpendicular displacement, field units). */
	twistAmp: number;
	/** Plasma cooling profile (0..1). High = clean cool-down; low = noisy. */
	cleanCool: number;
	/** Total path length (used by terminals to position themselves). */
	length: number;
}

/**
 * Rotate a 2D vector around the origin.
 */
function rotate(v: { x: number; y: number }, angle: number): { x: number; y: number } {
	const c = Math.cos(angle);
	const s = Math.sin(angle);
	return { x: c * v.x - s * v.y, y: s * v.x + c * v.y };
}

/**
 * Approximate Bezier arc length by sampling at fixed steps. Used for
 * positioning the terminal at the curve's end — we already know p3 in
 * field space, but the screen-projected length is what matters for the
 * terminal's offset.
 */
function bezierLength(
	p0: { x: number; y: number },
	p1: { x: number; y: number },
	p2: { x: number; y: number },
	p3: { x: number; y: number }
): number {
	let len = 0;
	let prevX = p0.x;
	let prevY = p0.y;
	const steps = 16;
	for (let i = 1; i <= steps; i++) {
		const t = i / steps;
		const mt = 1 - t;
		const x = mt * mt * mt * p0.x + 3 * mt * mt * t * p1.x + 3 * mt * t * t * p2.x + t * t * t * p3.x;
		const y = mt * mt * mt * p0.y + 3 * mt * mt * t * p1.y + 3 * mt * t * t * p2.y + t * t * t * p3.y;
		len += Math.sqrt((x - prevX) ** 2 + (y - prevY) ** 2);
		prevX = x;
		prevY = y;
	}
	return len;
}

/**
 * Compute a filament path at ignition.
 *
 *   - Base direction: segment's clock angle, rotated by Φ contribution.
 *   - Length: segment-driven (see segments.ts lengthFor).
 *   - p3: footpoint + length * direction, then bent by LENSING_GAIN *
 *     emissionGradient (terminus pulled toward strongest neighbour).
 *   - p1, p2: laterally offset along the path to make a coronal arch
 *     rather than a straight stroke. Lateral amplitude scales with age
 *     (older = smoother = smaller offset → straighter arch; newer =
 *     more lateral kick = ragged).
 *   - Twist frequency scales inverse with age. Twist amplitude scales
 *     with volatility (proxied by |emissionShareDelta24h|).
 *   - Plasma cleanCool comes directly from honesty.
 */
export function computeFilamentPath(
	cell: CellSnapshot,
	segment: SegmentDef,
	allCells: readonly CellSnapshot[]
): FilamentPath {
	const length = segment.lengthFor({
		uid: cell.uid,
		// SegmentDef.lengthFor takes a SubnetRow. CellSnapshot is a
		// strict subset of SubnetRow's shape; cast at the boundary.
		// (See segments.ts — lengthFor only reads emissionShare,
		// daysSinceRegistration, and emissionShareDelta24h.)
		name: null,
		emissionShare: cell.emissionShare,
		alphaPrice: null,
		marketCap: null,
		validators: null,
		miners: null,
		realRevenueSignal: cell.realRevenueSignal,
		signalSource: null,
		registeredAtBlock: null,
		daysSinceRegistration: cell.daysSinceRegistration,
		emissionShareDelta24h: cell.emissionShareDelta24h,
		emissionShareDelta7epoch: null,
		realRevenueSignalDelta24h: cell.realRevenueSignalDelta24h,
		rankDelta24h: null
	});

	// $tao field rotates the bloom orientation.
	const flow = taoFlowAt(cell, allCells);
	const taoRot = taoRotationFromFlow(flow);

	// Base direction at segment.angle + taoRot. Convention: angle 0 = up,
	// clockwise positive — so (sin θ, -cos θ) in screen-y-up convention,
	// or (sin θ, cos θ) in math-y-up. Our field space is math-y-up
	// (positive y is "up"), and the breathe shader treats positive y as
	// up via the orthographic camera. So:
	const dirAngle = segment.angle + taoRot;
	const dx = Math.sin(dirAngle);
	const dy = Math.cos(dirAngle);

	const radius = 0; // we don't have the cell's drawn radius here; the
	// caller can use cell-actual radius later. For the field-space
	// computation, treating the cell as a point and applying
	// FILAMENT_FOOTPOINT_OFFSET keeps the calculation independent of
	// the renderer's R_MIN / R_MAX choices.
	const p0 = {
		x: cell.x + dx * (radius + FILAMENT_FOOTPOINT_OFFSET),
		y: cell.y + dy * (radius + FILAMENT_FOOTPOINT_OFFSET)
	};

	let p3 = { x: p0.x + dx * length, y: p0.y + dy * length };
	// Bend the terminus along the emission-field gradient at p3.
	const grad = emissionGradient(p3, allCells);
	const gradMag = Math.sqrt(grad.x * grad.x + grad.y * grad.y);
	if (gradMag > 1e-9) {
		const bendX = (grad.x / gradMag) * LENSING_GAIN * length;
		const bendY = (grad.y / gradMag) * LENSING_GAIN * length;
		p3 = { x: p3.x + bendX, y: p3.y + bendY };
	}

	// Age-driven lateral arch amplitude (older = smaller arch).
	const ageDays = ageDaysAt(cell);
	const youthfulness = Math.max(0, Math.min(1, 1 - ageDays / 365)); // 1 = brand new, 0 = >= 1 year
	const archAmp = length * (0.08 + 0.16 * youthfulness);

	// Perpendicular direction to (dx, dy) — rotate 90° anticlockwise.
	const perp = { x: -dy, y: dx };

	// p1 sits at ~1/3 along p0→p3, displaced by +archAmp; p2 at ~2/3,
	// displaced by -archAmp. Result: a coronal-arch shape.
	const v03 = { x: p3.x - p0.x, y: p3.y - p0.y };
	const p1 = {
		x: p0.x + v03.x * 0.33 + perp.x * archAmp,
		y: p0.y + v03.y * 0.33 + perp.y * archAmp
	};
	const p2 = {
		x: p0.x + v03.x * 0.67 - perp.x * archAmp,
		y: p0.y + v03.y * 0.67 - perp.y * archAmp
	};

	// Twist frequency: high when young, low when old.
	const twistFreq =
		TWIST_FREQ_MIN +
		(TWIST_FREQ_MAX - TWIST_FREQ_MIN) * Math.exp(-ageDays / AGE_STIFFNESS_DAYS);

	// Twist amplitude: scales with volatility (|delta|).
	const vol = Math.min(
		1,
		Math.abs(cell.emissionShareDelta24h ?? 0) * 200 +
			Math.abs(cell.realRevenueSignalDelta24h ?? 0)
	);
	const twistAmp = TWIST_AMP_BASE * (0.5 + 0.8 * vol);

	// Plasma cooling profile from honesty (high signal = clean cool-down).
	const cleanCool = honestyAt(cell);

	const pathLength = bezierLength(p0, p1, p2, p3);

	return { p0, p1, p2, p3, twistFreq, twistAmp, cleanCool, length: pathLength };
}

/**
 * Evaluate a cubic Bezier at parameter t ∈ [0, 1]. Used by the ribbon
 * shader's CPU-side sampling fallback and by terminal placement.
 */
export function bezierPoint(path: FilamentPath, t: number): { x: number; y: number } {
	const mt = 1 - t;
	const m2 = mt * mt;
	const m3 = m2 * mt;
	const t2 = t * t;
	const t3 = t2 * t;
	return {
		x: m3 * path.p0.x + 3 * m2 * t * path.p1.x + 3 * mt * t2 * path.p2.x + t3 * path.p3.x,
		y: m3 * path.p0.y + 3 * m2 * t * path.p1.y + 3 * mt * t2 * path.p2.y + t3 * path.p3.y
	};
}

/**
 * Tangent vector at parameter t (not normalised).
 */
export function bezierTangent(path: FilamentPath, t: number): { x: number; y: number } {
	const mt = 1 - t;
	const a = 3 * mt * mt;
	const b = 6 * mt * t;
	const c = 3 * t * t;
	return {
		x: a * (path.p1.x - path.p0.x) + b * (path.p2.x - path.p1.x) + c * (path.p3.x - path.p2.x),
		y: a * (path.p1.y - path.p0.y) + b * (path.p2.y - path.p1.y) + c * (path.p3.y - path.p2.y)
	};
}
