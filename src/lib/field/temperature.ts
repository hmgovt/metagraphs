/**
 * Honesty-axis temperature mapping (D11 — Stage 4 wires the §3.3.1 signal
 * straight through to the colour-temperature channel of the field shader).
 *
 *   temperature 0.0 → COLD (#1e6f8a teal — deep-ocean, subsidy-farming)
 *   temperature 0.5 → MID  (#c8d8d0 desaturated near-white — neutral / missing)
 *   temperature 1.0 → WARM (#f0bc76 amber — real productive use)
 *
 * Rules (in this precedence order; each is its own honest statement):
 *
 * 1. `realRevenueSignal` is non-null → pass it straight through. The §3.3.1
 *    formula is the source of truth; this layer only forwards.
 *
 * 2. `realRevenueSignal` is null → the data is missing for this subnet
 *    (§3.3 mandates a labelled neutral state). Render mid temperature so
 *    the cell is visible but neither claimed warm nor claimed cold.
 *
 * No `emissionShare === 0 → cold` shortcut — the §3.3.1 signal already
 * encodes that case (low-confidence (P+V)/2 → near-0 for un-staffed
 * subnets). Bypassing the formula would amount to a parallel honesty
 * layer competing with the spec.
 */

import type { SubnetRow } from '$lib/types/network';
import { TEMPERATURE_NEUTRAL } from './config';

export function temperatureFor(subnet: SubnetRow): number {
	if (subnet.realRevenueSignal === null) {
		return TEMPERATURE_NEUTRAL;
	}
	const t = subnet.realRevenueSignal;
	if (!Number.isFinite(t)) return TEMPERATURE_NEUTRAL;
	return Math.max(0, Math.min(1, t));
}
