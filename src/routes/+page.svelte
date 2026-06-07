<script lang="ts">
	import SiteHeader from '$lib/components/SiteHeader.svelte';
	import NetworkStatus from '$lib/components/NetworkStatus.svelte';
	import SiteFooter from '$lib/components/SiteFooter.svelte';
	import Field from '$lib/field/Field.svelte';
	import { networkStore, refresh } from '$lib/state/network.svelte';

	$effect(() => {
		void refresh();
	});

	let dataLoaded = $derived(networkStore.data !== null);
</script>

<svelte:head>
	<title>Metagraphs</title>
</svelte:head>

<div class="page" class:data-loaded={dataLoaded}>
	<div class="pulse" aria-hidden="true"></div>

	<SiteHeader />

	<main>
		<Field ariaLabel="Bittensor network field" />
	</main>

	<footer>
		<NetworkStatus />
		<SiteFooter />
	</footer>
</div>

<style>
	.page {
		position: relative;
		min-height: 100dvh;
		display: grid;
		grid-template-rows: auto 1fr auto;
		background: var(--bg-deep);
		overflow: hidden;
	}

	.pulse {
		position: absolute;
		inset: -20%;
		z-index: 0;
		background: radial-gradient(
			circle at 50% 50%,
			rgba(240, 188, 118, 0.32) 0%,
			rgba(232, 156, 92, 0.18) 14%,
			rgba(200, 120, 70, 0.07) 32%,
			rgba(180, 100, 60, 0.02) 55%,
			rgba(180, 100, 60, 0) 72%
		);
		filter: blur(1px);
		animation: breathe 7s ease-in-out infinite;
		transform-origin: 50% 50%;
		will-change: opacity, transform;
		pointer-events: none;
		transition: opacity 600ms ease-out;
	}

	.page.data-loaded .pulse {
		opacity: 0.5;
	}

	.page > :global(header),
	main,
	footer {
		position: relative;
		z-index: 1;
	}

	main {
		display: block;
		position: relative;
		min-height: 0;
	}

	footer {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 0.65rem;
		padding: 1.25rem 1.5rem 2rem;
	}

	@keyframes breathe {
		0%,
		100% {
			opacity: 0.5;
			transform: scale(0.94);
		}
		50% {
			opacity: 1;
			transform: scale(1.08);
		}
	}

	@media (prefers-reduced-motion: reduce) {
		.pulse {
			animation: none;
			opacity: 0.85;
			transform: scale(1);
		}

		.page.data-loaded .pulse {
			opacity: 0.45;
		}
	}
</style>
