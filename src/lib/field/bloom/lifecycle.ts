/**
 * Five-phase filament lifecycle machine + the easings (SPEC §3.9).
 *
 * Pure functions only — `phaseAtTime(ms, reduced)` returns the current
 * phase + per-phase progress 0..1, and the shader/renderer reads from
 * that. No mutable state in this module.
 */

import {
	IGNITION_MS,
	ERUPTION_MS,
	APEX_MS,
	COOLING_MS,
	DECAY_MS,
	TERMINAL_FADE_DELAY_MS,
	TERMINAL_FADE_DURATION_MS
} from './config';

export type Phase = 'igniting' | 'erupting' | 'apex' | 'cooling' | 'afterglow' | 'decaying' | 'extinct';

export interface PhaseState {
	phase: Phase;
	/** 0..1 within current phase. */
	progress: number;
	/** 0..1, fraction of the eruption front reached. Used by the ribbon shader. */
	front: number;
	/** 0..1, plasma cooling progress; 0 at apex, 1 at end of cooling. */
	cooling: number;
	/** 0..1, terminal text opacity. */
	terminalOpacity: number;
	/** 0..1, overall ribbon brightness multiplier. */
	brightness: number;
	/** 0..1, ribbon-extent alpha — eruption builds it up, decay tears it down. */
	extent: number;
}

const SUSTAIN_START_MS = IGNITION_MS + ERUPTION_MS + APEX_MS + COOLING_MS;

// --- Easings ---

export function easeOutQuad(t: number): number {
	return 1 - (1 - t) * (1 - t);
}

export function easeInQuad(t: number): number {
	return t * t;
}

export function easeOutCubic(t: number): number {
	return 1 - Math.pow(1 - t, 3);
}

export function easeInOutCubic(t: number): number {
	return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
}

export function easeOutBack(t: number): number {
	const c1 = 1.70158;
	const c3 = c1 + 1;
	return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2);
}

/**
 * Reduced motion: collapse the lifecycle to ignition (50 ms) → afterglow.
 * Same data; no animation. Triggered when `prefers-reduced-motion: reduce`
 * is true.
 */
function reducedMotionState(elapsedMs: number, decayingSinceMs: number | null): PhaseState {
	const IGN_R = 50;
	if (decayingSinceMs !== null) {
		const dp = Math.min(1, decayingSinceMs / DECAY_MS);
		const k = 1 - dp;
		return {
			phase: dp >= 1 ? 'extinct' : 'decaying',
			progress: dp,
			front: 1,
			cooling: 1,
			terminalOpacity: k,
			brightness: 0.3 * k,
			extent: k
		};
	}
	if (elapsedMs < IGN_R) {
		const p = Math.max(0, Math.min(1, elapsedMs / IGN_R));
		return {
			phase: 'igniting',
			progress: p,
			front: p,
			cooling: 1,
			terminalOpacity: 0,
			brightness: 0.3 * p,
			extent: p
		};
	}
	return {
		phase: 'afterglow',
		progress: 0,
		front: 1,
		cooling: 1,
		terminalOpacity: 1,
		brightness: 0.3,
		extent: 1
	};
}

/**
 * Compute the lifecycle state for a single filament at a given time.
 *
 * @param elapsedMs      ms since ignition
 * @param decayingSinceMs ms since the cursor left (null if still sustained)
 * @param reduced        whether prefers-reduced-motion: reduce is on
 */
export function phaseAtTime(
	elapsedMs: number,
	decayingSinceMs: number | null,
	reduced: boolean
): PhaseState {
	if (reduced) return reducedMotionState(elapsedMs, decayingSinceMs);

	if (decayingSinceMs !== null) {
		const dp = Math.min(1, decayingSinceMs / DECAY_MS);
		const k = easeInQuad(1 - dp);
		return {
			phase: dp >= 1 ? 'extinct' : 'decaying',
			progress: dp,
			front: 1,
			cooling: 1,
			terminalOpacity: Math.max(0, 1 - dp * 2), // text fades faster than ribbon
			brightness: 0.25 * k,
			extent: k
		};
	}

	// Igniting: brightness ramps; nothing erupted yet.
	if (elapsedMs < IGNITION_MS) {
		const p = elapsedMs / IGNITION_MS;
		const b = easeOutBack(p);
		return {
			phase: 'igniting',
			progress: p,
			front: 0,
			cooling: 0,
			terminalOpacity: 0,
			brightness: b * 0.5,
			extent: 0.05
		};
	}

	// Erupting: moving front advances from 0 to 1; extent grows.
	const eruptStart = IGNITION_MS;
	const eruptEnd = IGNITION_MS + ERUPTION_MS;
	if (elapsedMs < eruptEnd) {
		const p = (elapsedMs - eruptStart) / ERUPTION_MS;
		const e = easeOutQuad(p);
		return {
			phase: 'erupting',
			progress: p,
			front: e,
			cooling: 0,
			terminalOpacity: 0,
			brightness: 0.7 + 0.3 * e,
			extent: e
		};
	}

	// Apex: front at 1; full twist; peak brightness; text still hidden.
	const apexEnd = eruptEnd + APEX_MS;
	if (elapsedMs < apexEnd) {
		const p = (elapsedMs - eruptEnd) / APEX_MS;
		return {
			phase: 'apex',
			progress: p,
			front: 1,
			cooling: 0,
			terminalOpacity: 0,
			brightness: 1,
			extent: 1
		};
	}

	// Cooling: plasma temperature curves down; text fades in toward the end.
	const coolEnd = apexEnd + COOLING_MS;
	if (elapsedMs < coolEnd) {
		const p = (elapsedMs - apexEnd) / COOLING_MS;
		const c = easeInOutCubic(p);
		const intoCoolMs = elapsedMs - apexEnd;
		const fadeStart = TERMINAL_FADE_DELAY_MS;
		const termP = Math.max(0, Math.min(1, (intoCoolMs - fadeStart) / TERMINAL_FADE_DURATION_MS));
		return {
			phase: 'cooling',
			progress: p,
			front: 1,
			cooling: c,
			terminalOpacity: termP,
			brightness: 1 - 0.7 * c,
			extent: 1
		};
	}

	// Afterglow: steady state until decay starts.
	return {
		phase: 'afterglow',
		progress: Math.min(1, (elapsedMs - coolEnd) / 1000),
		front: 1,
		cooling: 1,
		terminalOpacity: 1,
		brightness: 0.3,
		extent: 1
	};
}

/** Total ms from ignition to end of cooling phase — useful for cascade pacing. */
export const FULL_LIFECYCLE_MS = SUSTAIN_START_MS;
