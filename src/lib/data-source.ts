/**
 * Browser-facing URL constants for the snapshot pipeline (Stage 2).
 *
 * Per D9, snapshots commit to a separate `data` branch in this repo so
 * Cloudflare Pages doesn't redeploy on every snapshot. The browser
 * fetches the latest snapshot via jsDelivr's GitHub CDN — no new infra,
 * no new domain, no recurring cost. The schema is served alongside the
 * data for self-describing consumers.
 *
 * Stage 2 only co-locates the constants with the pipeline that
 * produces the files. Stage 4 wires the browser fetch when the
 * breathing field lands.
 */

export const NETWORK_JSON_URL =
	'https://cdn.jsdelivr.net/gh/hmgovt/metagraphs@data/static/network.json';

export const NETWORK_META_URL =
	'https://cdn.jsdelivr.net/gh/hmgovt/metagraphs@data/static/network-meta.json';

export const NETWORK_SCHEMA_URL =
	'https://cdn.jsdelivr.net/gh/hmgovt/metagraphs@data/static/network.schema.json';
