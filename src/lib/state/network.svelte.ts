/**
 * Network snapshot state — the single source of truth the rest of the
 * app reads from. Fetches `network.json` + `network-meta.json` from the
 * jsDelivr-served `data` branch (per D9) and refreshes every 5 minutes.
 *
 * Stage 4 will read this for cell counts; Stage 5 will read it for the
 * per-cell signal that drives honesty colouring. Field-rendering
 * concerns do not live here.
 *
 * Browser-only. Imports are safe at SSR time (no top-level fetch); the
 * first `refresh()` is a no-op on the server.
 */

import { SvelteDate } from 'svelte/reactivity';
import { NETWORK_JSON_URL, NETWORK_META_URL } from '$lib/data-source';
import type { NetworkJson, NetworkMeta } from '$lib/types/network';

const REFRESH_INTERVAL_MS = 5 * 60 * 1000;
/**
 * Accepted snapshot schema versions. v1 was the initial release; v2
 * added `logoUrl` per subnet (SPEC §3.8, 2026-06-07); v3 added full
 * subnet identity (description, social links) + computed
 * daysSinceRegistration + deltas, for the bloom (SPEC §3.9, 2026-06-08).
 * All three are accepted during the rollout window; once v3 is the
 * dominant shape on the data branch we keep v1/v2 here too so a future
 * rollback never breaks the page. Drop older versions only when the
 * schema bumps again and we want to force the upgrade.
 */
const ACCEPTED_SCHEMA_VERSIONS: ReadonlyArray<number> = [1, 2, 3];

const state = $state<{
	data: NetworkJson | null;
	meta: NetworkMeta | null;
	loading: boolean;
	error: Error | null;
	lastFetchedAt: Date | null;
}>({
	data: null,
	meta: null,
	loading: false,
	error: null,
	lastFetchedAt: null
});

let inFlight: Promise<void> | null = null;
let intervalStarted = false;

async function fetchJson<T>(url: string): Promise<T> {
	const res = await fetch(url, { cache: 'no-cache' });
	if (!res.ok) {
		throw new Error(`fetch ${url}: HTTP ${res.status}`);
	}
	return (await res.json()) as T;
}

/** Fetch the snapshot + meta once and update store. On-demand or interval-driven. */
export function refresh(): Promise<void> {
	if (typeof window === 'undefined') return Promise.resolve();
	if (inFlight) return inFlight;

	if (!intervalStarted) {
		intervalStarted = true;
		setInterval(() => {
			void refresh();
		}, REFRESH_INTERVAL_MS);
	}

	state.loading = true;
	state.error = null;

	inFlight = (async () => {
		try {
			const [data, meta] = await Promise.all([
				fetchJson<NetworkJson>(NETWORK_JSON_URL),
				fetchJson<NetworkMeta>(NETWORK_META_URL)
			]);
			if (!ACCEPTED_SCHEMA_VERSIONS.includes(data.schemaVersion)) {
				throw new Error(
					`Unexpected schemaVersion ${data.schemaVersion} (accepted: ${ACCEPTED_SCHEMA_VERSIONS.join(', ')}). Browser types are out of sync with static/network.schema.json.`
				);
			}
			state.data = data;
			state.meta = meta;
			state.lastFetchedAt = new SvelteDate();
		} catch (e) {
			state.error = e instanceof Error ? e : new Error(String(e));
		} finally {
			state.loading = false;
			inFlight = null;
		}
	})();

	return inFlight;
}

export const networkStore = {
	get data() {
		return state.data;
	},
	get meta() {
		return state.meta;
	},
	get loading() {
		return state.loading;
	},
	get error() {
		return state.error;
	},
	get lastFetchedAt() {
		return state.lastFetchedAt;
	}
};
