/**
 * Pivots data/network.ndjson's last row into static/network.json,
 * deriving registration/deregistration events by diffing against the
 * second-to-last row.
 *
 * Stale-marker behaviour: when network-meta.json reports stale=true,
 * the orchestrator has already written a stale static/network.json
 * (the prior snapshot's body with a fresh asOf). Re-pivoting from the
 * NDJSON's last row would clobber that flag, so this script is a no-op
 * in that case.
 *
 * Usage: npx tsx scripts/build-network-json.ts
 */

import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs';
import { gzipSync } from 'zlib';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

import type { SnapshotRow, SubnetRow } from './snapshot-types.js';

const __dirname = fileURLToPath(new URL('.', import.meta.url));
const ROOT = join(__dirname, '..');
const NDJSON_PATH = join(ROOT, 'data', 'network.ndjson');
const NETWORK_JSON_PATH = join(ROOT, 'static', 'network.json');
const META_PATH = join(ROOT, 'static', 'network-meta.json');

const GZIP_WARN_BYTES = 500 * 1024; // 500 KB

interface NetworkJson extends SnapshotRow {
	events: {
		registrations: Array<{ uid: number; atBlock: number }>;
		deregistrations: Array<{ uid: number; atBlock: number }>;
	};
}

function ensureDir(path: string): void {
	const dir = dirname(path);
	if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
}

function readLastTwoRows(): { last: SnapshotRow | null; prev: SnapshotRow | null } {
	if (!existsSync(NDJSON_PATH)) return { last: null, prev: null };
	const text = readFileSync(NDJSON_PATH, 'utf-8').trim();
	if (!text) return { last: null, prev: null };
	const lines = text.split('\n').filter((l) => l.trim());
	const last = lines.length ? (JSON.parse(lines[lines.length - 1]) as SnapshotRow) : null;
	const prev = lines.length > 1 ? (JSON.parse(lines[lines.length - 2]) as SnapshotRow) : null;
	return { last, prev };
}

function deriveEvents(last: SnapshotRow, prev: SnapshotRow | null) {
	if (!prev) return { registrations: [], deregistrations: [] };
	const prevUids = new Set(prev.subnets.map((s) => s.uid));
	const lastUids = new Set(last.subnets.map((s) => s.uid));
	const registrations: Array<{ uid: number; atBlock: number }> = [];
	const deregistrations: Array<{ uid: number; atBlock: number }> = [];

	for (const s of last.subnets) {
		if (!prevUids.has(s.uid)) {
			registrations.push({ uid: s.uid, atBlock: s.registeredAtBlock ?? last.block });
		}
	}
	for (const s of prev.subnets) {
		if (!lastUids.has(s.uid)) {
			deregistrations.push({ uid: s.uid, atBlock: last.block });
		}
	}
	return { registrations, deregistrations };
}

function ensureSubnetSort(subnets: SubnetRow[]): SubnetRow[] {
	return [...subnets].sort((a, b) => a.uid - b.uid);
}

/**
 * Normalise SubnetRow shape to match the currently-pinned schema before
 * the pivot writes static/network.json. This is the safety net for
 * schemaVersion transitions: when the NDJSON's last row was written by
 * a prior pipeline version that didn't carry every v2-required field
 * (e.g. v1 NDJSON rows pre-2026-06-08 don't have `logoUrl`), the pivot
 * backfills the field with a defensible default so validation passes.
 *
 * The defensible default for every nullable v2+ field is `null` — the
 * §3.3 "labelled neutral state" contract. A null here is the honest
 * statement "this snapshot's data source does not provide this field
 * yet"; the next snapshot run on the new pipeline version will fill it
 * with real data.
 */
function normaliseSubnetForSchemaV2(s: SubnetRow): SubnetRow {
	return {
		...s,
		// v2 backfill (SPEC §3.8): older NDJSON rows pre-date the field.
		logoUrl: s.logoUrl ?? null
	};
}

function main(): number {
	console.log('=== build-network-json ===');

	if (existsSync(META_PATH)) {
		try {
			const meta = JSON.parse(readFileSync(META_PATH, 'utf-8')) as { stale?: boolean };
			if (meta.stale === true) {
				console.log(
					'  meta.stale=true — orchestrator already wrote a stale network.json. Skipping pivot.'
				);
				return 0;
			}
		} catch (err) {
			console.warn(
				`  Could not parse network-meta.json (${err instanceof Error ? err.message : String(err)}); continuing.`
			);
		}
	}

	const { last, prev } = readLastTwoRows();
	if (!last) {
		console.log('  data/network.ndjson is empty or missing — nothing to pivot.');
		return 0;
	}

	const pivoted: NetworkJson = {
		schemaVersion: 2,
		asOf: last.asOf,
		epoch: last.epoch,
		block: last.block,
		stale: last.stale,
		source: last.source,
		totalSubnets: last.subnets.length,
		subnets: ensureSubnetSort(last.subnets).map(normaliseSubnetForSchemaV2),
		events: deriveEvents(last, prev)
	};

	ensureDir(NETWORK_JSON_PATH);
	const jsonStr = JSON.stringify(pivoted);
	writeFileSync(NETWORK_JSON_PATH, jsonStr + '\n');
	const sizeBytes = Buffer.byteLength(jsonStr, 'utf-8');
	const gzBytes = gzipSync(jsonStr).length;
	console.log(
		`  wrote network.json: ${(sizeBytes / 1024).toFixed(1)} KB (gz ${(gzBytes / 1024).toFixed(1)} KB) — epoch ${pivoted.epoch}, ${pivoted.subnets.length} subnets`
	);
	if (pivoted.events.registrations.length || pivoted.events.deregistrations.length) {
		console.log(
			`  events: +${pivoted.events.registrations.length} registrations, -${pivoted.events.deregistrations.length} deregistrations`
		);
	}

	if (gzBytes > GZIP_WARN_BYTES) {
		console.warn(
			`  ⚠ gzipped payload ${(gzBytes / 1024).toFixed(1)} KB exceeds ${GZIP_WARN_BYTES / 1024} KB canary — investigate schema regressions.`
		);
	}

	return 0;
}

process.exit(main());
