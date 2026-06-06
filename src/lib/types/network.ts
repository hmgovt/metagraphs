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
	schemaVersion: 1;
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
