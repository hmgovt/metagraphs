/**
 * Honesty-axis temperature mapping (D11 — Stage 4 wires the §3.3.1 signal
 * straight through to the colour-temperature channel of the field shader).
 *
 *   temperature 0.0 → COLD (#1bd0ff vivid cyan — subsidy-farming)
 *   temperature 0.5 → MID  (#5a5180 slate-purple — neutral / missing)
 *   temperature 1.0 → WARM (#ffb733 saturated gold — real productive use)
 *
 * Rules (in this precedence order; each is its own honest statement):
 *
 * 1. `realRevenueSignal` is non-null → stretch via `signal × SIGNAL_GAIN`,
 *    clamped to [0, 1]. The §3.3.1 formula is the source of truth; this
 *    layer forwards it but applies a calibrated gain so that today's
 *    best-performing subnets (real signal ~0.6 max) actually reach the
 *    warm end of the colour spectrum. Without the gain the field uses
 *    only the cold half of the gradient and the warm end is never seen.
 *
 *    The gain is calibrated, not adaptive — it does NOT renormalise per
 *    snapshot. A subnet whose signal goes from 0.4 to 0.6 still gets
 *    warmer over time; the gain just maps the realistic range onto the
 *    full colour range.
 *
 * 2. `realRevenueSignal` is null → the data is missing for this subnet
 *    (§3.3 mandates a labelled neutral state). Render mid temperature so
 *    the cell is visible but neither claimed warm nor claimed cold.
 *
 * No `emissionShare === 0 → cold` shortcut — the §3.3.1 signal already
 * encodes that case (low-confidence (P+V)/2 → near-0 for un-staffed
 * subnets). Bypassing the formula would amount to a parallel honesty
 * layer competing with the spec.
 *
 * Future: when the §3.3.1 formula bumps to v2 and produces signals that
 * naturally use the full [0, 1] range, drop SIGNAL_GAIN back to 1.
 */

import type { SubnetRow } from '$lib/types/network';
import { TEMPERATURE_NEUTRAL } from './config';

const SIGNAL_GAIN = 1.55;

export function temperatureFor(subnet: SubnetRow): number {
	if (subnet.realRevenueSignal === null) {
		return TEMPERATURE_NEUTRAL;
	}
	const t = subnet.realRevenueSignal;
	if (!Number.isFinite(t)) return TEMPERATURE_NEUTRAL;
	return Math.max(0, Math.min(1, t * SIGNAL_GAIN));
}
