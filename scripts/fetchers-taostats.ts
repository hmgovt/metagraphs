/**
 * Taostats REST fetcher. Paced to the documented free-tier limit
 * (5 req/min — 12 s + jitter between calls). Retries 429/5xx with
 * exponential backoff. All log output is routed through redactUrl /
 * redactHeaders so the API key never reaches stdout.
 *
 * Two endpoints are merged into a single SubnetRow[] per snapshot:
 *   - /api/subnet/latest/v1   — operational state (emission integer,
 *                                validator/miner counts, registration block)
 *   - /api/dtao/pool/latest/v1 — pool state (name, alpha price, market cap)
 *
 * The merge keys on netuid and the emission integer is normalised by
 * the total across all subnets into a 0..1 share, per §7.4 of the spec.
 */

import {
	TAOSTATS_BASE,
	TAOSTATS_ENDPOINTS,
	TAOSTATS_PACING_MS,
	TAOSTATS_PACING_JITTER_MS,
	RAO_PER_TAO
} from './sources.js';
import type { SubnetRow } from './snapshot-types.js';

export interface FetchResult<T> {
	data: T;
	httpStatus: number;
	rowCount: number;
	url: string;
}

const RETRY_DELAYS = [2_000, 5_000, 12_000];

function jitter(base: number, spread: number): number {
	return base + Math.floor(Math.random() * spread);
}

export function redactUrl(url: string): string {
	return url.replace(/apikey=[^&]*/gi, 'apikey=***').replace(/api[_-]?key=[^&]*/gi, 'api_key=***');
}

export function redactHeaders(headers: Record<string, string>): Record<string, string> {
	const out: Record<string, string> = {};
	for (const [k, v] of Object.entries(headers)) {
		out[k] = /^authorization$|^x-api-key$|^api[_-]?key$/i.test(k) ? '***' : v;
	}
	return out;
}

export async function pace(): Promise<void> {
	const wait = jitter(TAOSTATS_PACING_MS, TAOSTATS_PACING_JITTER_MS);
	await new Promise((r) => setTimeout(r, wait));
}

function authHeaders(apiKey: string): Record<string, string> {
	// Taostats's public docs gate the auth-scheme page behind login.
	// Their convention (per third-party client examples and confirmed
	// against the live API on 2026-06-06) is Authorization: <key> with
	// no "Bearer " prefix.
	return {
		Authorization: apiKey,
		accept: 'application/json',
		'user-agent': 'metagraphs-snapshot/1.0 (+https://metagraphs.live)'
	};
}

async function fetchWithRetry(
	url: string,
	headers: Record<string, string>,
	label: string
): Promise<Response> {
	const redactedUrl = redactUrl(url);
	for (let attempt = 0; attempt <= RETRY_DELAYS.length; attempt++) {
		try {
			const res = await fetch(url, { headers });
			if (res.ok) return res;
			if ((res.status === 429 || res.status >= 500) && attempt < RETRY_DELAYS.length) {
				console.warn(
					`  Taostats ${label} HTTP ${res.status}, retrying in ${RETRY_DELAYS[attempt]}ms (${redactedUrl})`
				);
				await new Promise((r) => setTimeout(r, RETRY_DELAYS[attempt]));
				continue;
			}
			throw new Error(`HTTP ${res.status} for ${label} (${redactedUrl})`);
		} catch (err) {
			if (attempt < RETRY_DELAYS.length) {
				const msg = err instanceof Error ? err.message : String(err);
				console.warn(`  Taostats ${label} error, retrying: ${msg}`);
				await new Promise((r) => setTimeout(r, RETRY_DELAYS[attempt]));
				continue;
			}
			throw err;
		}
	}
	throw new Error(`Exhausted retries for ${label}`);
}

function num(...candidates: unknown[]): number | null {
	for (const c of candidates) {
		if (c === null || c === undefined || c === '') continue;
		const n = typeof c === 'number' ? c : parseFloat(String(c));
		if (Number.isFinite(n)) return n;
	}
	return null;
}

function intOrNull(...candidates: unknown[]): number | null {
	const n = num(...candidates);
	return n === null ? null : Math.trunc(n);
}

function str(...candidates: unknown[]): string | null {
	for (const c of candidates) {
		if (c === null || c === undefined) continue;
		const s = String(c).trim();
		if (s) return s;
	}
	return null;
}

/**
 * Generic paged GET. Unwraps both `{ data: [...] }` and bare-array
 * response shapes.
 */
async function fetchList(
	apiKey: string,
	path: string,
	query: Record<string, string>,
	label: string
): Promise<{ list: unknown[]; httpStatus: number; redactedUrl: string }> {
	const qs = new URLSearchParams(query);
	const url = `${TAOSTATS_BASE}${path}?${qs.toString()}`;
	const headers = authHeaders(apiKey);
	console.log(`  Fetching Taostats ${path} ...`);
	const res = await fetchWithRetry(url, headers, label);
	const json = (await res.json()) as unknown;
	let list: unknown[];
	if (Array.isArray(json)) {
		list = json;
	} else if (json && typeof json === 'object' && Array.isArray((json as { data?: unknown }).data)) {
		list = (json as { data: unknown[] }).data;
	} else {
		throw new Error(
			`Unexpected Taostats response shape for ${label}: ${JSON.stringify(json).slice(0, 200)}`
		);
	}
	return { list, httpStatus: res.status, redactedUrl: redactUrl(url) };
}

interface OpsPartial {
	uid: number;
	rawEmission: number;
	validators: number | null;
	miners: number | null;
	registeredAtBlock: number | null;
	taostatsSignal: number | null;
}

function mapOpsRow(raw: Record<string, unknown>): OpsPartial {
	const uid = intOrNull(raw.netuid, raw.uid, raw.subnet_id);
	if (uid === null) {
		throw new Error(`Taostats ops row missing netuid: ${JSON.stringify(raw).slice(0, 200)}`);
	}
	const rawEmission = num(raw.emission, raw.emission_share) ?? 0;

	// Tier A signal — speculative field names; null when absent.
	const sigRaw = num(
		raw.real_revenue_signal,
		raw.realRevenueSignal,
		raw.paid_demand_signal,
		raw.paid_usage_score
	);
	const taostatsSignal =
		sigRaw === null
			? null
			: sigRaw > 1
				? Math.min(sigRaw / 100, 1)
				: Math.max(0, Math.min(1, sigRaw));

	return {
		uid,
		rawEmission,
		// active_miners is what we want for §3.3.1's P_s — `active_keys`
		// counts every registered neuron including the validator slots,
		// which over-credits saturation.
		validators: intOrNull(raw.active_validators, raw.validators, raw.validator_count),
		miners: intOrNull(raw.active_miners, raw.miners, raw.miner_count),
		registeredAtBlock: intOrNull(
			raw.registration_block_number,
			raw.registered_at_block,
			raw.registration_block
		),
		taostatsSignal
	};
}

interface PoolPartial {
	uid: number;
	name: string | null;
	alphaPrice: number | null;
	marketCap: number | null;
}

function mapPoolRow(raw: Record<string, unknown>): PoolPartial {
	const uid = intOrNull(raw.netuid, raw.uid);
	if (uid === null) {
		throw new Error(`Taostats pool row missing netuid: ${JSON.stringify(raw).slice(0, 200)}`);
	}
	const marketCapRao = num(raw.market_cap, raw.marketCap, raw.alpha_market_cap);
	return {
		uid,
		name: str(raw.name, raw.subnet_name),
		alphaPrice: num(raw.price, raw.alpha_price, raw.last_price),
		marketCap: marketCapRao === null ? null : marketCapRao / RAO_PER_TAO
	};
}

/**
 * High-level: fetch both endpoints, merge by uid, normalise emission
 * into a 0..1 share, and return SubnetRow[] sorted by uid ascending.
 * Two paced calls per snapshot.
 *
 * Note: this returns SubnetRow[] without identity fields populated —
 * the identity endpoint is fetched separately by `fetchSubnetIdentity()`
 * and merged in the orchestrator (so the call sequencing + pacing
 * remain explicit at the top level).
 */
export async function fetchSubnets(apiKey: string): Promise<FetchResult<SubnetRow[]>> {
	const opsCfg = TAOSTATS_ENDPOINTS.subnetLatest;
	const opsResp = await fetchList(apiKey, opsCfg.path, opsCfg.query, 'subnet/latest/v1');
	const ops = opsResp.list.map((r) => mapOpsRow(r as Record<string, unknown>));
	const totalEmission = ops.reduce((a, b) => a + b.rawEmission, 0);

	await pace();

	const poolCfg = TAOSTATS_ENDPOINTS.subnetPool;
	const poolResp = await fetchList(apiKey, poolCfg.path, poolCfg.query, 'dtao/pool/latest/v1');
	const pools = new Map<number, PoolPartial>(
		poolResp.list.map((r) => {
			const p = mapPoolRow(r as Record<string, unknown>);
			return [p.uid, p];
		})
	);

	const rows: SubnetRow[] = ops
		.map((o): SubnetRow => {
			const pool = pools.get(o.uid);
			return {
				uid: o.uid,
				name: pool?.name ?? null,
				emissionShare: totalEmission > 0 ? o.rawEmission / totalEmission : null,
				alphaPrice: pool?.alphaPrice ?? null,
				marketCap: pool?.marketCap ?? null,
				validators: o.validators,
				miners: o.miners,
				realRevenueSignal: o.taostatsSignal,
				signalSource: o.taostatsSignal === null ? null : 'taostats',
				registeredAtBlock: o.registeredAtBlock,
				logoUrl: null,
				// v3 — identity fields are merged in by fetchSubnetIdentity later in the orchestrator.
				description: null,
				github: null,
				twitter: null,
				discord: null,
				website: null,
				// v3 — computed in the orchestrator pivot from registeredAtBlock + block.
				daysSinceRegistration: null,
				// v3 — computed in the orchestrator from NDJSON history.
				emissionShareDelta24h: null,
				emissionShareDelta7epoch: null,
				realRevenueSignalDelta24h: null,
				rankDelta24h: null
			};
		})
		.sort((a, b) => a.uid - b.uid);

	console.log(`  → ${rows.length} subnets (totalEmission=${totalEmission})`);
	return {
		data: rows,
		httpStatus: opsResp.httpStatus,
		rowCount: rows.length,
		url: `${opsResp.redactedUrl} + ${poolResp.redactedUrl}`
	};
}

export interface SubnetIdentityRecord {
	logoUrl: string | null;
	description: string | null;
	github: string | null;
	twitter: string | null;
	discord: string | null;
	website: string | null;
}

/**
 * Bulk subnet identity — one call returns every netuid plus
 * owner-declared metadata: logo URL, description, social links.
 * Per SPEC §3.8 (schema v2 logos) and §3.9 (schema v3 full identity for
 * the bloom). Returns a Map keyed by uid; missing entries default to a
 * record of all-null at the caller.
 *
 * URLs are *not* HEAD-validated — broken / 404 / stale owner URLs
 * (a current example is uid 3's "https://deprecated.png") travel
 * honestly through the snapshot and are handled by the browser's
 * `<img onerror>` fallback (logos) or by leaving the link visibly broken
 * in the bloom's Links terminal (the owner's statement, not the
 * pipeline's responsibility). The pipeline does NOT police owners.
 */
export async function fetchSubnetIdentity(
	apiKey: string
): Promise<FetchResult<Map<number, SubnetIdentityRecord>>> {
	const cfg = TAOSTATS_ENDPOINTS.subnetIdentity;
	const resp = await fetchList(apiKey, cfg.path, cfg.query, 'subnet/identity/v1');

	const map = new Map<number, SubnetIdentityRecord>();
	for (const r of resp.list) {
		const row = r as Record<string, unknown>;
		const uid = intOrNull(row.netuid, row.uid, row.subnet_id);
		if (uid === null) continue;
		map.set(uid, {
			logoUrl: str(row.logo_url, row.logoUrl),
			description: str(row.description, row.summary, row.about),
			github: str(row.github_url, row.githubUrl, row.github, row.repo_url),
			twitter: str(row.twitter_url, row.twitterUrl, row.twitter, row.x_url),
			discord: str(row.discord_url, row.discordUrl, row.discord),
			website: str(row.website, row.url, row.homepage)
		});
	}

	const withLogos = [...map.values()].filter((v) => v.logoUrl !== null).length;
	const withDescription = [...map.values()].filter((v) => v.description !== null).length;
	console.log(
		`  → ${map.size} identities (${withLogos} with logos, ${withDescription} with descriptions)`
	);
	return {
		data: map,
		httpStatus: resp.httpStatus,
		rowCount: map.size,
		url: resp.redactedUrl
	};
}
