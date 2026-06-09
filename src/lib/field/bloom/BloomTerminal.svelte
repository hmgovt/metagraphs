<script lang="ts">
	/* eslint-disable svelte/no-navigation-without-resolve -- terminal hrefs are external URLs (github/twitter/discord/website), not SvelteKit routes */
	import type { TerminalState } from './controller';

	type Props = {
		terminal: TerminalState;
	};
	let { terminal }: Props = $props();

	/**
	 * Convert the segment's clock angle into a CSS transform that pushes
	 * the terminal radially outward from its anchor point (the filament's
	 * p3). The smooth formula `(-50 + 50·sin θ, -50 - 50·cos θ)` traces
	 * a unit-circle offset that lands each cardinal position cleanly:
	 *   12 o'clock (θ=0): translate(-50%, -100%) — sits above anchor
	 *    3 o'clock (θ=π/2): translate(0%, -50%) — sits right of anchor
	 *    6 o'clock (θ=π): translate(-50%, 0%) — sits below anchor
	 *    9 o'clock (θ=3π/2): translate(-100%, -50%) — sits left of anchor
	 * Diagonal positions interpolate. The result: 8 terminals fan around
	 * the cell, each anchored at its filament tip, none overlapping the
	 * cell or each other.
	 */
	let tx = $derived(-50 + 50 * Math.sin(terminal.segmentAngle));
	let ty = $derived(-50 - 50 * Math.cos(terminal.segmentAngle));
	/** Identity terminal centers itself (it's the most important; sits above the cell). */
	let isIdentity = $derived(terminal.emphasisName);
	let alignClass = $derived(
		terminal.segmentAngle > Math.PI / 2 && terminal.segmentAngle < (3 * Math.PI) / 2
			? 'align-down'
			: 'align-up'
	);
</script>

<div
	class="terminal {alignClass}"
	class:identity={isIdentity}
	style="left: {terminal.screen.x}px; top: {terminal.screen
		.y}px; opacity: {terminal.opacity}; transform: translate({tx}%, {ty}%);"
>
	{#if terminal.content.logoUrl}
		<!--
			Owner-declared logo per §3.8. The bloom's Identity terminal is the
			only place the logo renders at all; §3.7 zoom labels were the v2
			use site and remain (they're a different surface).
		-->
		<img
			class="terminal-logo"
			src={terminal.content.logoUrl}
			alt=""
			loading="lazy"
			referrerpolicy="no-referrer"
			onerror={(e) => ((e.currentTarget as HTMLImageElement).style.display = 'none')}
		/>
	{/if}
	<div class="terminal-body">
		{#each terminal.content.lines as line (line.text)}
			{#if line.href}
				<a
					class="terminal-line"
					class:value={line.emphasis === 'value'}
					class:detail={line.emphasis === 'detail'}
					class:name={line.emphasis === 'name'}
					href={line.href}
					target="_blank"
					rel="noreferrer"
				>
					{line.text}
				</a>
			{:else}
				<span
					class="terminal-line"
					class:value={line.emphasis === 'value'}
					class:detail={line.emphasis === 'detail'}
					class:name={line.emphasis === 'name'}
				>
					{line.text}
				</span>
			{/if}
		{/each}
	</div>
</div>

<style>
	.terminal {
		position: fixed;
		/* transform comes from inline style — radial offset by quadrant. */
		pointer-events: none; /* overall container is non-blocking; links re-enable below */
		z-index: 6;
		font-family: var(--font-mono);
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 0.2rem;
		max-width: 170px;
		text-align: center;
		transition: opacity 200ms ease;
		filter: drop-shadow(0 0 12px rgba(255, 180, 100, 0.25));
	}

	.terminal.identity {
		max-width: 220px;
	}

	.terminal-logo {
		width: 22px;
		height: 22px;
		border-radius: 50%;
		object-fit: cover;
		background: rgba(255, 220, 180, 0.06);
		box-shadow: 0 0 10px rgba(255, 180, 100, 0.45);
		flex: 0 0 auto;
	}

	.terminal-body {
		display: flex;
		flex-direction: column;
		gap: 0.12rem;
		align-items: center;
	}

	.terminal-line {
		display: block;
		color: #f3d6a8;
		text-decoration: none;
		font-size: 0.66rem;
		letter-spacing: 0.08em;
		text-transform: lowercase;
		line-height: 1.25;
		text-shadow:
			0 0 2px rgba(8, 6, 14, 0.95),
			0 0 6px rgba(8, 6, 14, 0.75),
			0 0 14px rgba(255, 180, 100, 0.45);
		white-space: nowrap;
		pointer-events: none;
	}

	a.terminal-line {
		pointer-events: auto;
		cursor: pointer;
		transition: filter 160ms ease;
	}
	a.terminal-line:hover {
		filter: brightness(1.4);
	}

	.terminal-line.detail {
		color: #d9b78a;
		font-size: 0.6rem;
		opacity: 0.85;
	}

	.terminal-line.name {
		color: #f7e3b8;
		font-size: 0.82rem;
		font-weight: 600;
		letter-spacing: 0.12em;
		text-transform: lowercase;
		/* SPEC §3.9: identity name terminal gets a 50%-bigger diffuse border for scan-readability. */
		text-shadow:
			0 0 3px rgba(8, 6, 14, 0.98),
			0 0 9px rgba(8, 6, 14, 0.8),
			0 0 18px rgba(255, 180, 100, 0.55);
	}

	.terminal-line.value {
		color: #f3d6a8;
	}
</style>
