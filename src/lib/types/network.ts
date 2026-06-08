/**
 * Browser-facing TypeScript types for the snapshot schema.
 *
 * `static/network.schema.json` is the contract — these types must move
 * in lock-step with it. If you change one, change the other. See
 * SPEC §7.4. Mirrored intentionally (not re-exported) from
 * `scripts/snapshot-types.ts` so the browser bundle does not pull in
 * the Node-side pipeline.
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
	/**
	 * Owner-declared logo URL (snapshot schema v2; SPEC §3.8).
	 * Optional because v1 snapshots in the wild don't carry the field —
	 * the browser store accepts schemaVersion 1, 2, OR 3 during rollout,
	 * and `subnet.logoUrl ?? null` is the safe read.
	 */
	logoUrl?: string | null;
	/**
	 * v3 — owner-declared identity (SPEC §3.9, the bloom).
	 * Optional for rollout-window compatibility: v1/v2 snapshots don't carry
	 * these. The bloom reads `?? null` and renders the appropriate segment
	 * as the labelled neutral state.
	 */
	description?: string | null;
	github?: string | null;
	twitter?: string | null;
	discord?: string | null;
	website?: string | null;
	/** Computed in pivot from (block - registeredAtBlock) / 7200. v3. */
	daysSinceRegistration?: number | null;
	/**
	 * Pre-computed deltas vs the running NDJSON history (v3).
	 * null when insufficient history; first ~20 epochs after the v3
	 * cutover read as null and the trend filament renders neutrally.
	 */
	emissionShareDelta24h?: number | null;
	emissionShareDelta7epoch?: number | null;
	realRevenueSignalDelta24h?: number | null;
	rankDelta24h?: number | null;
}

export interface LifecycleEvent {
	uid: number;
	atBlock: number;
}

export interface NetworkEvents {
	registrations: LifecycleEvent[];
	deregistrations: LifecycleEvent[];
}

export interface NetworkJson {
	/**
	 * Schema version. v1 was the initial release; v2 added `logoUrl` per
	 * subnet (2026-06-07); v3 added full identity + deltas for the bloom
	 * (2026-06-08, SPEC §3.9). The browser accepts any of {1, 2, 3} during
	 * rollout — `ACCEPTED_SCHEMA_VERSIONS` in the store is the source of
	 * truth. Once v3 snapshots dominate the data branch, we keep accepting
	 * v1/v2 too so a future rollback never breaks the page.
	 */
	schemaVersion: 1 | 2 | 3;
	asOf: string;
	epoch: number;
	block: number;
	stale: boolean;
	source: 'taostats' | 'subtensor';
	totalSubnets: number;
	subnets: SubnetRow[];
	events: NetworkEvents;
}

export type EndpointStatus =
	| { status: 'ok'; httpStatus?: number; rowCount?: number; url?: string }
	| { status: 'forward-filled'; url?: string }
	| { status: 'fallback'; via: 'subtensor'; reason: string; url?: string }
	| { status: 'failed'; reason: string; url?: string };

export interface NetworkMeta {
	lastRun: string;
	epoch: number | null;
	block: number | null;
	source: 'taostats' | 'subtensor' | null;
	stale: boolean;
	endpoints: Record<string, EndpointStatus>;
	asOfWindow: string[];
	notes?: string[];
}
