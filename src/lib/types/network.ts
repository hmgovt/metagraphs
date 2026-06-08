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
	 * Optional on the type because v1 snapshots in the wild don't carry the
	 * field — the browser store accepts schemaVersion 1 OR 2 during the
	 * rollout window, and `subnet.logoUrl ?? null` is the safe read.
	 */
	logoUrl?: string | null;
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
	 * subnet (2026-06-07). The browser accepts either during the rollout
	 * window between the schema-update commits and the first v2 snapshot
	 * landing on the `data` branch.
	 */
	schemaVersion: 1 | 2;
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
