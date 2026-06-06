/**
 * Endpoint configuration for the Taostats REST API and the Subtensor
 * WS fallback. Mirrors BWI's scripts/sources.ts shape.
 *
 * No secrets here — the Taostats key is read from process.env at fetch
 * time and never logged. URLs are routed through redactUrl() before any
 * console output.
 */

export const TAOSTATS_BASE = 'https://api.taostats.io';

/**
 * Taostats endpoints used by the snapshot. Treat field names as a
 * defensive contract — Taostats's public docs are sparse on response
 * shape, so the parser in fetchers-taostats.ts uses a fallback chain
 * across the most likely field aliases.
 */
export const TAOSTATS_ENDPOINTS = {
	/**
	 * Bulk subnet operational state — emission, validator/miner counts,
	 * registration block. One page covers the entire ~128-subnet
	 * network. Does NOT include name, alpha price, or market cap; those
	 * come from `subnetPool` below.
	 */
	subnetLatest: {
		path: '/api/subnet/latest/v1',
		query: { page: '1', limit: '512', order: 'netuid_asc' }
	},
	/**
	 * Bulk dTAO pool state — subnet name, alpha price, market cap,
	 * pool reserves. Keyed by netuid; merged with subnetLatest in the
	 * fetcher.
	 */
	subnetPool: {
		path: '/api/dtao/pool/latest/v1',
		query: { page: '1', limit: '512', order: 'netuid_asc' }
	}
} as const;

/**
 * Free-tier pacing per docs: 5 req/min. 12 s + jitter between calls
 * keeps us comfortably under the limit even if a retry adds a call.
 */
export const TAOSTATS_PACING_MS = 12_000;
export const TAOSTATS_PACING_JITTER_MS = 1_500;

/**
 * Public Subtensor RPC for the @polkadot/api fallback (D10). One
 * connection per workflow run; close cleanly with api.disconnect().
 */
export const SUBTENSOR_WS = 'wss://entrypoint-finney.opentensor.ai:443';

/**
 * Yuma epoch length in blocks. 360 blocks ≈ 72 min at ~12 s/block.
 */
export const EPOCH_BLOCKS = 360;

export function epochFromBlock(block: number): number {
	return Math.floor(block / EPOCH_BLOCKS);
}

/**
 * Block reward post-December-2025 halving, used by the v1 real-revenue
 * formula (SPEC §3.3.1). ~0.5 TAO/block.
 */
export const TAO_PER_BLOCK_POST_HALVING = 0.5;

/**
 * Hard cap on validators per subnet (SPEC §2). Drives the V_s
 * normalisation in §3.3.1.
 */
export const VALIDATOR_PERMIT_CAP = 64;

/**
 * Saturation point for miner-participation normalisation in §3.3.1.
 * Not a hard cap — subnets can have more registered miners — but the
 * formula clamps at this value.
 */
export const MINER_SATURATION = 256;

/**
 * Substrate balance scale: 1 TAO = 1e9 RAO. Taostats's `market_cap`,
 * `total_tao`, `alpha_in_pool`, etc. are reported in RAO. Divide by
 * this to land in TAO units.
 */
export const RAO_PER_TAO = 1_000_000_000;
