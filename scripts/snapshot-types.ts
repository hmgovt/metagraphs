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
}

export interface SnapshotRow {
	schemaVersion: 1;
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
