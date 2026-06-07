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

	<main>
		<Field ariaLabel="Bittensor network field" />
	</main>

	<div class="overlay-top">
		<SiteHeader />
	</div>

	<div class="overlay-bottom">
		<NetworkStatus />
		<SiteFooter />
	</div>
</div>

<style>
	.page {
		position: relative;
		width: 100vw;
		height: 100dvh;
		background: var(--bg-deep);
		overflow: hidden;
	}

	main {
		position: absolute;
		inset: 0;
		z-index: 1;
	}

	.pulse {
		position: absolute;
		inset: -20%;
		z-index: 0;
		background: radial-gradient(
			circle at 50% 50%,
			rgba(240, 188, 118, 0.28) 0%,
			rgba(232, 156, 92, 0.15) 14%,
			rgba(200, 120, 70, 0.06) 32%,
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
		opacity: 0.35;
	}

	.overlay-top {
		position: absolute;
		top: 0;
		left: 0;
		right: 0;
		z-index: 2;
		display: flex;
		justify-content: center;
		pointer-events: none;
	}

	.overlay-top :global(header) {
		padding: 1.25rem 1rem 0.5rem;
		background: linear-gradient(180deg, rgba(2, 3, 5, 0.6) 0%, rgba(2, 3, 5, 0) 100%);
		width: 100%;
	}

	.overlay-bottom {
		position: absolute;
		bottom: 0;
		left: 0;
		right: 0;
		z-index: 2;
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 0.4rem;
		padding: 1.5rem 1rem 1.1rem;
		background: linear-gradient(0deg, rgba(2, 3, 5, 0.7) 0%, rgba(2, 3, 5, 0) 100%);
		pointer-events: none;
	}

	.overlay-bottom :global(a) {
		pointer-events: auto;
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
			opacity: 0.75;
			transform: scale(1);
		}

		.page.data-loaded .pulse {
			opacity: 0.3;
		}
	}
</style>
