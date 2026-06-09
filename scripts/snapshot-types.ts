/**
 * Internal row shape produced by both fetchers and consumed by the
 * orchestrator / pivot. Maps 1:1 to the §7.4 snapshot schema except
 * `events` (derived in the pivot, not the fetch).
 */

export interface SubnetRow {
	uid: number;
	name: string | null;
	emissionShare: number | null;
	alphaPrice: number | null;
	marketCap: number | null;
	validators: number | null;
	miners: number | null;
	realRevenueSignal: number | null;
	signalSource: 'taostats' | 'computed:v1' | 'computed:v1-low-confidence' | null;
	registeredAtBlock: number | null;
	/** Owner-declared logo URL (schema v2). null when owner has not registered one. */
	logoUrl: string | null;
	/** v3 (SPEC §3.9, the bloom) — owner-declared identity. null when absent. */
	description: string | null;
	github: string | null;
	twitter: string | null;
	discord: string | null;
	website: string | null;
	/** v3 — computed in pivot from (block - registeredAtBlock) / 7200 (~12 s/block). */
	daysSinceRegistration: number | null;
	/**
	 * v3 — pre-computed deltas vs NDJSON history. null when insufficient
	 * history (first ~20 epochs after v3 cutover, or either window-side
	 * is null).
	 */
	emissionShareDelta24h: number | null;
	emissionShareDelta7epoch: number | null;
	realRevenueSignalDelta24h: number | null;
	rankDelta24h: number | null;
}

export interface SnapshotRow {
	schemaVersion: 3;
	asOf: string;
	epoch: number;
	block: number;
	stale: boolean;
	source: 'taostats' | 'subtensor';
	totalSubnets: number;
	subnets: SubnetRow[];
}

export type EndpointStatus =
	| { status: 'ok'; httpStatus?: number; rowCount?: number; url?: string }
	| { status: 'forward-filled'; url?: string }
	| { status: 'fallback'; via: 'subtensor'; reason: string; url?: string }
	| { status: 'failed'; reason: string; url?: string };

export interface SnapshotHealth {
	lastRun: string;
	epoch: number | null;
	block: number | null;
	source: 'taostats' | 'subtensor' | null;
	stale: boolean;
	endpoints: Record<string, EndpointStatus>;
	asOfWindow: string[];
	notes?: string[];
}
