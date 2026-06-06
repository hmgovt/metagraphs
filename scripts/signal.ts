/**
 * Real-revenue signal v1 — implements SPEC §3.3.1 verbatim.
 *
 *   M_s = clamp(marketCap_s / cumulativeEmissionApprox_s, 0, 1)
 *   P_s = min(miners_s / 256, 1)
 *   V_s = validators_s / 64
 *   RealUseSignal_s = 0.6·M_s + 0.2·P_s + 0.2·V_s
 *
 * with the §3.3.1 edge cases for cumulativeEmissionApprox==0,
 * marketCap==null, and historicalEmissionShare==0.
 *
 * Pure function over the SubnetRow fields the schema already exposes
 * plus the running history; idempotent across re-runs of the same
 * snapshot. Tier A (Taostats direct field) is resolved upstream in
 * fetchers-taostats.ts; this module is Tier C only.
 */

import { TAO_PER_BLOCK_POST_HALVING, VALIDATOR_PERMIT_CAP, MINER_SATURATION } from './sources.js';
import type { SubnetRow } from './snapshot-types.js';

/**
 * Mean emission share for each uid across the NDJSON history. uids
 * absent from history fall back to their current snapshot value at the
 * call site.
 */
export function meanEmissionShareByUid(
	historyRows: Array<{ subnets?: SubnetRow[] }>
): Map<number, number> {
	const sum = new Map<number, number>();
	const count = new Map<number, number>();
	for (const row of historyRows) {
		if (!row.subnets) continue;
		for (const s of row.subnets) {
			if (s.emissionShare === null) continue;
			sum.set(s.uid, (sum.get(s.uid) ?? 0) + s.emissionShare);
			count.set(s.uid, (count.get(s.uid) ?? 0) + 1);
		}
	}
	const mean = new Map<number, number>();
	for (const [uid, total] of sum) {
		const c = count.get(uid) ?? 0;
		if (c > 0) mean.set(uid, total / c);
	}
	return mean;
}

function clamp01(x: number): number {
	if (x < 0) return 0;
	if (x > 1) return 1;
	return x;
}

export interface ComputedSignal {
	value: number | null;
	source: 'computed:v1' | 'computed:v1-low-confidence' | null;
}

/**
 * Computes Tier C real-revenue signal per §3.3.1. Returns { value:
 * null, source: null } when marketCap is missing (cell renders as
 * labelled neutral state per §3.3).
 */
export function computeRealRevenueSignal(
	row: SubnetRow,
	currentBlock: number,
	historicalEmissionShareByUid: Map<number, number>
): ComputedSignal {
	if (row.marketCap === null) {
		return { value: null, source: null };
	}

	const ageBlocks =
		row.registeredAtBlock !== null ? Math.max(0, currentBlock - row.registeredAtBlock) : 0;
	const historicalShare = historicalEmissionShareByUid.get(row.uid) ?? row.emissionShare ?? 0;

	const cumulativeEmissionApprox = ageBlocks * TAO_PER_BLOCK_POST_HALVING * historicalShare;

	const P = row.miners === null ? 0 : Math.min(row.miners / MINER_SATURATION, 1);
	const V = row.validators === null ? 0 : Math.min(row.validators / VALIDATOR_PERMIT_CAP, 1);

	// Edge case: cumulativeEmissionApprox == 0 (registered this epoch
	// or registeredAtBlock unknown) → M is undefined, drop it.
	if (cumulativeEmissionApprox === 0) {
		const value = (P + V) / 2;
		return { value, source: 'computed:v1-low-confidence' };
	}

	const M = clamp01(row.marketCap / cumulativeEmissionApprox);
	const value = 0.6 * M + 0.2 * P + 0.2 * V;
	return { value: clamp01(value), source: 'computed:v1' };
}

/**
 * Applies the Tier C formula to every row whose signalSource is still
 * null (i.e. Taostats didn't supply Tier A). Mutates rows in place to
 * keep the call sites compact; returns the rows for chaining.
 */
export function applyRealRevenueSignal(
	rows: SubnetRow[],
	currentBlock: number,
	historyRows: Array<{ subnets?: SubnetRow[] }>
): SubnetRow[] {
	const historical = meanEmissionShareByUid(historyRows);
	for (const row of rows) {
		if (row.signalSource !== null) continue; // Tier A already in place
		const { value, source } = computeRealRevenueSignal(row, currentBlock, historical);
		row.realRevenueSignal = value;
		row.signalSource = source;
	}
	return rows;
}
