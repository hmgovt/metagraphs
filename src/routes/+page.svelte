<script lang="ts">
	const asOf = '—';
</script>

<svelte:head>
	<title>Metagraphs</title>
</svelte:head>

<main>
	<div class="pulse" aria-hidden="true"></div>

	<div class="content">
		<h1>Metagraphs</h1>
		<p class="descriptor">A living visualisation of the Bittensor network.</p>
	</div>

	<footer>
		<span class="stamp">as of {asOf}</span>
	</footer>
</main>

<style>
	main {
		position: relative;
		min-height: 100dvh;
		display: grid;
		grid-template-rows: 1fr auto;
		background: var(--bg-deep);
		overflow: hidden;
	}

	.pulse {
		position: absolute;
		inset: -20%;
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
	}

	.content {
		grid-row: 1;
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		gap: 0.75rem;
		padding: 2rem;
		text-align: center;
		z-index: 1;
	}

	h1 {
		margin: 0;
		font-size: clamp(2.25rem, 6vw, 3.75rem);
		font-weight: 300;
		letter-spacing: 0.08em;
		color: var(--fg);
		text-shadow: 0 0 28px rgba(240, 188, 118, 0.28);
	}

	.descriptor {
		margin: 0;
		font-size: clamp(0.95rem, 1.4vw, 1.1rem);
		font-weight: 300;
		letter-spacing: 0.03em;
		color: var(--fg-dim);
		max-width: 36ch;
	}

	footer {
		grid-row: 2;
		display: flex;
		justify-content: center;
		padding: 1.5rem 2rem 2rem;
		z-index: 1;
	}

	.stamp {
		font-family: var(--font-mono);
		font-size: 0.72rem;
		letter-spacing: 0.18em;
		text-transform: uppercase;
		color: var(--fg-dim);
		opacity: 0.65;
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
	}
</style>
