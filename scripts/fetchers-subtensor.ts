/**
 * Subtensor RPC fallback via @polkadot/api (D10). Connects to a public
 * Finney endpoint and assembles the same SubnetRow shape from on-chain
 * storage, so the orchestrator doesn't care which source produced the
 * row.
 *
 * Substrate storage names vary across Subtensor runtime versions, so
 * every read is wrapped in a try/null swallow — per-field misses are
 * forward-filled upstream. The fallback's job is to keep the snapshot
 * moving when Taostats is down; per-field completeness is best-effort.
 */

import { ApiPromise, WsProvider } from '@polkadot/api';
import { SUBTENSOR_WS, EPOCH_BLOCKS } from './sources.js';
import type { SubnetRow } from './snapshot-types.js';

export interface ChainHead {
	block: number;
	epoch: number;
}

let cachedApi: ApiPromise | null = null;

export async function getApi(): Promise<ApiPromise> {
	if (cachedApi) return cachedApi;
	const provider = new WsProvider(SUBTENSOR_WS);
	const api = await ApiPromise.create({ provider, throwOnConnect: true });
	cachedApi = api;
	return api;
}

export async function disconnectApi(): Promise<void> {
	if (cachedApi) {
		await cachedApi.disconnect();
		cachedApi = null;
	}
}

export async function fetchChainHead(): Promise<ChainHead> {
	const api = await getApi();
	const header = await api.rpc.chain.getHeader();
	const block = header.number.toNumber();
	return { block, epoch: Math.floor(block / EPOCH_BLOCKS) };
}

/**
 * Reads a Subtensor storage entry safely. Returns null for any error
 * (missing pallet/storage, decoding failure, network blip). The caller
 * forward-fills.
 */
async function tryRead<T>(fn: () => Promise<T>): Promise<T | null> {
	try {
		return await fn();
	} catch {
		return null;
	}
}

/**
 * Decodes a Subtensor name (Vec<u8>) into a printable string. Returns
 * null for empty or unprintable names.
 */
function decodeName(raw: unknown): string | null {
	if (raw === null || raw === undefined) return null;
	try {
		// @polkadot/api returns Vec<u8> as { toHuman } or as a Uint8Array.
		// Accept both.
		const obj = raw as { toUtf8?: () => string; toHuman?: () => unknown; toString?: () => string };
		if (typeof obj.toUtf8 === 'function') {
			const s = obj.toUtf8();
			return s && s.trim() ? s : null;
		}
		if (typeof obj.toHuman === 'function') {
			const h = obj.toHuman();
			if (typeof h === 'string' && h.trim()) return h;
		}
		const s = String(raw).trim();
		return s ? s : null;
	} catch {
		return null;
	}
}

function asNumber(raw: unknown): number | null {
	if (raw === null || raw === undefined) return null;
	const obj = raw as { toNumber?: () => number; toBigInt?: () => bigint; toString?: () => string };
	try {
		if (typeof obj.toNumber === 'function') return obj.toNumber();
		if (typeof obj.toBigInt === 'function') {
			const b = obj.toBigInt();
			return b > BigInt(Number.MAX_SAFE_INTEGER) ? Number.MAX_SAFE_INTEGER : Number(b);
		}
		const n = parseFloat(String(raw));
		return Number.isFinite(n) ? n : null;
	} catch {
		return null;
	}
}

/**
 * Walks every active subnet via on-chain storage and assembles SubnetRow
 * entries. The exact storage names below match the Bittensor runtime as
 * of the May 2026 dTAO refactor; mismatches at runtime fall through to
 * null and the orchestrator forward-fills.
 */
export async function fetchSubnetsFromChain(): Promise<SubnetRow[]> {
	const api = await getApi();
	const subtensor = (
		api.query as Record<string, Record<string, (...args: unknown[]) => Promise<unknown>>>
	).subtensorModule;
	if (!subtensor) {
		throw new Error('Subtensor pallet not found on this chain');
	}

	const totalRaw = await tryRead(() => subtensor.totalNetworks());
	const total = asNumber(totalRaw) ?? 0;
	if (total === 0) {
		throw new Error('Subtensor reports zero subnets — refusing to write an empty snapshot');
	}

	// Read emission values for normalisation. emissionValues is keyed by
	// uid and the integer values sum to a constant (typically 1e9 or
	// similar). We normalise by their sum to land in 0..1.
	const emissionByUid = new Map<number, number>();
	let emissionTotal = 0;
	for (let uid = 0; uid < total; uid++) {
		const e = asNumber(await tryRead(() => subtensor.emissionValues(uid)));
		if (e !== null && e >= 0) {
			emissionByUid.set(uid, e);
			emissionTotal += e;
		}
	}

	const rows: SubnetRow[] = [];
	for (let uid = 0; uid < total; uid++) {
		const nameRaw = await tryRead(() => subtensor.subnetworkN(uid)); // count of registered neurons; not name
		// Name lookup — pallet/storage name varies; try a few candidates.
		const subnetNameRaw =
			(await tryRead(() => subtensor.subnetIdentities(uid))) ??
			(await tryRead(() => subtensor.subnetNames(uid)));
		const neuronCount = asNumber(nameRaw);

		// Alpha pool reserves (dTAO). subnetAlphaIn = alpha tokens in the
		// pool; subnetTAO = TAO reserve. Price = TAO/alpha; market cap ≈
		// alphaIn * price + outstanding (approximation; for v1 we use
		// pool TAO reserve as a proxy for market cap).
		const alphaIn = asNumber(await tryRead(() => subtensor.subnetAlphaIn(uid)));
		const taoIn = asNumber(await tryRead(() => subtensor.subnetTAO(uid)));
		const alphaPrice = alphaIn !== null && alphaIn > 0 && taoIn !== null ? taoIn / alphaIn : null;
		// Substrate balances are in RAO (1 TAO = 1e9 RAO). Convert.
		const marketCap = taoIn !== null ? taoIn / 1e9 : null;
		const alphaPriceTao = alphaPrice;

		const registeredAtBlock = asNumber(await tryRead(() => subtensor.networkRegisteredAt(uid)));

		// Validator / miner counts derived from per-uid neuron metadata.
		// In v1 we report total neuron count as `miners` (best-effort)
		// and leave `validators` null when the validator-permit storage
		// isn't queryable; the formula treats null as 0 in V_s.
		rows.push({
			uid,
			name: decodeName(subnetNameRaw),
			emissionShare:
				emissionByUid.has(uid) && emissionTotal > 0
					? (emissionByUid.get(uid) ?? 0) / emissionTotal
					: null,
			alphaPrice: alphaPriceTao,
			marketCap,
			validators: null,
			miners: neuronCount,
			realRevenueSignal: null,
			signalSource: null,
			registeredAtBlock,
			// The chain does not carry owner-declared logo URLs (§3.8 is
			// a Taostats identity-endpoint thing). On the Subtensor
			// fallback path, logoUrl is always null and forward-fill
			// rescues it from the prior row.
			logoUrl: null
		});
	}

	rows.sort((a, b) => a.uid - b.uid);
	return rows;
}
