/**
 * Per-Yuma-epoch snapshot orchestrator.
 *
 * Run flow:
 *   1. Open one Subtensor WS connection. Read current block + epoch.
 *   2. Epoch dedup against last data/network.ndjson row → exit 0 if same.
 *   3. Try Taostats (primary). On success → source: "taostats".
 *   4. Fallback to Subtensor on failure → source: "subtensor".
 *   5. Forward-fill per-field from prior row when both sources miss.
 *   6. Apply §3.3.1 real-revenue signal (Tier C computed) where Tier A
 *      didn't land.
 *   7. Append row to data/network.ndjson. Write static/network-meta.json.
 *      build-network-json.ts runs separately to pivot into network.json.
 *
 * Fail-soft contract (SPEC §7.1): both sources gone AND no prior row →
 * hard-fail; otherwise rewrite network.json with the prior body, fresh
 * asOf, stale: true, and commit honestly.
 *
 * Usage: TAOSTATS_API_KEY=... npx tsx scripts/fetch-snapshot.ts
 */

import 'dotenv/config';
import { readFileSync, appendFileSync, existsSync, mkdirSync, writeFileSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

import { fetchSubnets, fetchSubnetLogos, pace, redactUrl } from './fetchers-taostats.js';
import { fetchChainHead, fetchSubnetsFromChain, disconnectApi } from './fetchers-subtensor.js';
import { applyRealRevenueSignal } from './signal.js';
import { EPOCH_BLOCKS } from './sources.js';
import type { SnapshotRow, SubnetRow, EndpointStatus, SnapshotHealth } from './snapshot-types.js';

const __dirname = fileURLToPath(new URL('.', import.meta.url));
const ROOT = join(__dirname, '..');
const NDJSON_PATH = join(ROOT, 'data', 'network.ndjson');
const META_PATH = join(ROOT, 'static', 'network-meta.json');
const NETWORK_JSON_PATH = join(ROOT, 'static', 'network.json');

const AS_OF_WINDOW = 20; // rolling window written into network-meta.json

interface PriorState {
	lastRow: SnapshotRow | null;
	historyRows: SnapshotRow[];
}

function ensureDir(path: string): void {
	const dir = dirname(path);
	if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
}

function readNdjson(): PriorState {
	if (!existsSync(NDJSON_PATH)) return { lastRow: null, historyRows: [] };
	const text = readFileSync(NDJSON_PATH, 'utf-8').trim();
	if (!text) return { lastRow: null, historyRows: [] };
	const lines = text.split('\n');
	const historyRows: SnapshotRow[] = [];
	for (const line of lines) {
		if (!line.trim()) continue;
		try {
			historyRows.push(JSON.parse(line) as SnapshotRow);
		} catch (err) {
			console.warn(
				`  Skipping malformed NDJSON line: ${err instanceof Error ? err.message : String(err)}`
			);
		}
	}
	return {
		lastRow: historyRows.length ? historyRows[historyRows.length - 1] : null,
		historyRows
	};
}

/**
 * Per-field forward-fill: for each subnet uid in `current`, fill nulls
 * from the matching uid in `prior` and record which fields were filled.
 * Returns the count of forward-filled cells across all subnets.
 */
function forwardFill(current: SubnetRow[], prior: SubnetRow[] | null): number {
	if (!prior) return 0;
	const priorByUid = new Map(prior.map((s) => [s.uid, s]));
	let filled = 0;
	for (const row of current) {
		const p = priorByUid.get(row.uid);
		if (!p) continue;
		for (const key of [
			'name',
			'emissionShare',
			'alphaPrice',
			'marketCap',
			'validators',
			'miners',
			'registeredAtBlock',
			'logoUrl'
		] as const) {
			if (row[key] === null && p[key] !== null && p[key] !== undefined) {
				// eslint-disable-next-line @typescript-eslint/no-explicit-any
				(row as any)[key] = p[key];
				filled += 1;
			}
		}
	}
	return filled;
}

function writeMeta(meta: SnapshotHealth): void {
	ensureDir(META_PATH);
	writeFileSync(META_PATH, JSON.stringify(meta, null, 2) + '\n');
}

function asOfWindow(history: SnapshotRow[], current?: string): string[] {
	const window = history.map((r) => r.asOf);
	if (current) window.push(current);
	return window.slice(-AS_OF_WINDOW);
}

async function main(): Promise<number> {
	console.log('=== Metagraphs snapshot ===');
	const asOf = new Date().toISOString();

	const { lastRow, historyRows } = readNdjson();
	const endpoints: Record<string, EndpointStatus> = {};
	const notes: string[] = [];

	// --- Step 1: chain head via Subtensor (cheap, needed for dedup) ---
	let head: { block: number; epoch: number };
	try {
		head = await fetchChainHead();
		console.log(`  chain head: block=${head.block} epoch=${head.epoch}`);
		endpoints['subtensor:chainHead'] = { status: 'ok' };
	} catch (err) {
		const reason = err instanceof Error ? err.message : String(err);
		console.error(`  Subtensor chain head failed: ${reason}`);
		await disconnectApi();
		// Without a chain head we can't dedup or know the epoch. Hard
		// fail only if there's no prior row either; otherwise emit a
		// stale marker so the site keeps serving honest data.
		if (!lastRow) {
			writeMeta({
				lastRun: asOf,
				epoch: null,
				block: null,
				source: null,
				stale: false,
				endpoints: {
					'subtensor:chainHead': { status: 'failed', reason }
				},
				asOfWindow: [],
				notes: ['No chain head, no prior snapshot — refusing to write.']
			});
			console.error('No chain head and no prior snapshot. Aborting.');
			return 1;
		}
		await reserveStale(lastRow, historyRows, asOf, [
			`Subtensor chain head failed (${reason}); reusing prior snapshot block=${lastRow.block} epoch=${lastRow.epoch}.`
		]);
		return 0;
	}

	// --- Step 2: epoch dedup ---
	//
	// Epoch dedup is the normal-case skip. The exception is a schema
	// upgrade: when the last NDJSON row was written under an older
	// schemaVersion than the pipeline now emits, we re-run the fetch
	// even if the chain epoch hasn't advanced — otherwise the page
	// would render an outdated shape (missing new fields) for up to a
	// full Yuma epoch (~72 min) after the upgrade.
	const CURRENT_SCHEMA_VERSION = 2;
	const lastSchemaVersion =
		lastRow && typeof lastRow.schemaVersion === 'number' ? lastRow.schemaVersion : 0;
	const needsSchemaUpgrade = !!lastRow && lastSchemaVersion < CURRENT_SCHEMA_VERSION;
	if (lastRow && lastRow.epoch === head.epoch && !lastRow.stale && !needsSchemaUpgrade) {
		console.log(`  Already have epoch ${head.epoch}, skipping.`);
		writeMeta({
			lastRun: asOf,
			epoch: head.epoch,
			block: head.block,
			source: lastRow.source,
			stale: false,
			endpoints: { 'subtensor:chainHead': { status: 'ok' } },
			asOfWindow: asOfWindow(historyRows),
			notes: [`Epoch ${head.epoch} already captured at block ${lastRow.block}.`]
		});
		await disconnectApi();
		return 0;
	}
	if (needsSchemaUpgrade) {
		notes.push(
			`Re-fetching epoch ${head.epoch}: last NDJSON row is schemaVersion ${lastSchemaVersion}, pipeline emits ${CURRENT_SCHEMA_VERSION}.`
		);
		console.log(`  ${notes[notes.length - 1]}`);
	}

	// --- Step 3: Taostats primary ---
	let subnets: SubnetRow[] | null = null;
	let source: 'taostats' | 'subtensor' = 'taostats';
	const apiKey = process.env.TAOSTATS_API_KEY ?? '';
	if (!apiKey) {
		notes.push('TAOSTATS_API_KEY not set — skipping Taostats, going straight to Subtensor.');
		console.warn(`  ${notes[notes.length - 1]}`);
	} else {
		try {
			const result = await fetchSubnets(apiKey);
			endpoints['taostats:subnets'] = {
				status: 'ok',
				httpStatus: result.httpStatus,
				rowCount: result.rowCount,
				url: result.url
			};
			subnets = result.data;
		} catch (err) {
			const reason = err instanceof Error ? err.message : String(err);
			console.warn(`  Taostats primary failed: ${reason}`);
			endpoints['taostats:subnets'] = { status: 'failed', reason };
			notes.push(`Taostats failed: ${reason}`);
		}

		// Bulk identity (logos) — schema v2 / §3.8. One paced call;
		// non-critical: failures are logged and the forward-fill rescues
		// logoUrl from the prior row.
		if (subnets) {
			try {
				await pace();
				const logos = await fetchSubnetLogos(apiKey);
				endpoints['taostats:identity'] = {
					status: 'ok',
					httpStatus: logos.httpStatus,
					rowCount: logos.rowCount,
					url: logos.url
				};
				for (const row of subnets) {
					row.logoUrl = logos.data.get(row.uid) ?? null;
				}
			} catch (err) {
				const reason = err instanceof Error ? err.message : String(err);
				console.warn(`  Taostats identity failed: ${reason}`);
				endpoints['taostats:identity'] = { status: 'failed', reason };
				notes.push(`Taostats identity failed: ${reason} (logoUrl will forward-fill)`);
			}
		}
	}

	// --- Step 4: Subtensor fallback ---
	if (!subnets) {
		try {
			console.log('  Falling back to Subtensor for subnet data...');
			subnets = await fetchSubnetsFromChain();
			source = 'subtensor';
			endpoints['subtensor:subnetState'] = {
				status: 'fallback',
				via: 'subtensor',
				reason: 'Taostats unavailable',
				url: redactUrl('wss://entrypoint-finney.opentensor.ai:443')
			};
		} catch (err) {
			const reason = err instanceof Error ? err.message : String(err);
			console.error(`  Subtensor fallback failed: ${reason}`);
			endpoints['subtensor:subnetState'] = { status: 'failed', reason };
			await disconnectApi();
			// Both sources gone. Decide based on prior row.
			if (!lastRow) {
				writeMeta({
					lastRun: asOf,
					epoch: head.epoch,
					block: head.block,
					source: null,
					stale: false,
					endpoints,
					asOfWindow: [],
					notes: [...notes, 'Both sources failed and no prior snapshot exists — aborting.']
				});
				console.error('Both sources failed and no prior snapshot. Aborting.');
				return 1;
			}
			await reserveStale(lastRow, historyRows, asOf, [
				...notes,
				`Both sources failed (${reason}); reusing prior snapshot epoch=${lastRow.epoch}.`
			]);
			return 0;
		}
	}

	// --- Step 5: per-field forward-fill ---
	const filledCount = forwardFill(subnets, lastRow?.subnets ?? null);
	if (filledCount > 0) {
		endpoints['forward-fill'] = { status: 'forward-filled' };
		notes.push(`Forward-filled ${filledCount} field(s) from prior snapshot.`);
		console.log(`  forward-filled ${filledCount} field(s)`);
	}

	// --- Step 6: real-revenue signal (Tier C where Tier A absent) ---
	applyRealRevenueSignal(subnets, head.block, historyRows);

	// --- Step 7: assemble row, append NDJSON ---
	const row: SnapshotRow = {
		schemaVersion: 2,
		asOf,
		epoch: head.epoch,
		block: head.block,
		stale: false,
		source,
		totalSubnets: subnets.length,
		subnets
	};

	ensureDir(NDJSON_PATH);
	appendFileSync(NDJSON_PATH, JSON.stringify(row) + '\n');
	console.log(`  appended epoch ${head.epoch} (block ${head.block}, ${subnets.length} subnets)`);

	// --- Step 8: meta ---
	writeMeta({
		lastRun: asOf,
		epoch: head.epoch,
		block: head.block,
		source,
		stale: false,
		endpoints,
		asOfWindow: asOfWindow(historyRows, asOf),
		notes
	});

	await disconnectApi();
	return 0;
}

/**
 * Both-sources-gone fallback: rewrites network.json with the prior
 * snapshot body but a fresh asOf and stale: true so the site keeps
 * serving honest, labelled stale data. Does NOT append to NDJSON —
 * stale snapshots aren't history, they're a placeholder. Writes meta
 * so the workflow surfaces the staleness.
 */
async function reserveStale(
	lastRow: SnapshotRow,
	historyRows: SnapshotRow[],
	asOf: string,
	notes: string[]
): Promise<void> {
	const stale: SnapshotRow = { ...lastRow, asOf, stale: true };
	ensureDir(NETWORK_JSON_PATH);
	writeFileSync(NETWORK_JSON_PATH, JSON.stringify(stale) + '\n');
	writeMeta({
		lastRun: asOf,
		epoch: lastRow.epoch,
		block: lastRow.block,
		source: lastRow.source,
		stale: true,
		endpoints: {},
		asOfWindow: asOfWindow(historyRows, asOf),
		notes
	});
	console.warn(`  STALE: reused prior snapshot epoch=${lastRow.epoch}`);
	await disconnectApi();
}

main()
	.then((code) => {
		// Ensure async cleanup completes before exit.
		setImmediate(() => process.exit(code));
	})
	.catch(async (err) => {
		console.error('Snapshot failed:', err);
		await disconnectApi();
		process.exit(1);
	});

// Re-export for testing.
export { main, EPOCH_BLOCKS };
