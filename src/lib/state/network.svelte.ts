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
const EXPECTED_SCHEMA_VERSION = 1;

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
			if (data.schemaVersion !== EXPECTED_SCHEMA_VERSION) {
				throw new Error(
					`Unexpected schemaVersion ${data.schemaVersion} (expected ${EXPECTED_SCHEMA_VERSION}). Browser types are out of sync with static/network.schema.json.`
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
