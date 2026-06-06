<script lang="ts">
	import { networkStore } from '$lib/state/network.svelte';

	function formatAsOf(iso: string): string {
		const d = new Date(iso);
		const y = d.getUTCFullYear();
		const mo = String(d.getUTCMonth() + 1).padStart(2, '0');
		const da = String(d.getUTCDate()).padStart(2, '0');
		const h = String(d.getUTCHours()).padStart(2, '0');
		const m = String(d.getUTCMinutes()).padStart(2, '0');
		return `${y}-${mo}-${da} ${h}:${m} UTC`;
	}
</script>

<p class="status" aria-live="polite">
	{#if networkStore.data}
		{@const d = networkStore.data}
		{#if d.stale}<span class="marker">stale</span> ·
		{/if}as of {formatAsOf(d.asOf)} · epoch {d.epoch} · {d.totalSubnets} subnets · source {d.source}
	{:else if networkStore.error}
		as of — <span class="marker">· data unreachable</span>
	{:else}
		as of —
	{/if}
</p>

<style>
	.status {
		margin: 0;
		font-family: var(--font-mono);
		font-size: 0.72rem;
		letter-spacing: 0.14em;
		text-transform: lowercase;
		color: var(--fg-dim);
		opacity: 0.75;
		text-align: center;
	}

	.marker {
		opacity: 0.7;
	}
</style>
