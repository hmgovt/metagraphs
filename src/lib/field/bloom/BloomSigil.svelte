<script lang="ts">
	import type { SigilState } from './controller';
	import { SIGIL_DIAMETER_PX } from './config';

	type Props = {
		sigil: SigilState;
		onHover: (uid: number, segmentId: SigilState['segmentId'] | null) => void;
	};
	let { sigil, onHover }: Props = $props();
</script>

<button
	class="sigil"
	style="left: {sigil.screen.x}px; top: {sigil.screen
		.y}px; opacity: {sigil.opacity}; width: {SIGIL_DIAMETER_PX}px; height: {SIGIL_DIAMETER_PX}px;"
	aria-label={sigil.label}
	type="button"
	onpointerenter={() => onHover(sigil.uid, sigil.segmentId)}
	onpointerleave={() => onHover(sigil.uid, null)}
	onfocus={() => onHover(sigil.uid, sigil.segmentId)}
	onblur={() => onHover(sigil.uid, null)}
>
	<span class="dot"></span>
	<span class="label">{sigil.label}</span>
</button>

<style>
	.sigil {
		position: fixed;
		transform: translate(-50%, -50%);
		pointer-events: auto;
		z-index: 5;
		background: transparent;
		border: none;
		padding: 0;
		cursor: pointer;
		display: flex;
		align-items: center;
		justify-content: center;
		transition:
			opacity 300ms ease,
			filter 160ms ease;
	}

	.dot {
		width: 100%;
		height: 100%;
		border-radius: 50%;
		background: radial-gradient(
			circle,
			rgba(255, 220, 180, 0.7) 0%,
			rgba(255, 180, 100, 0.35) 60%,
			transparent 100%
		);
		box-shadow:
			inset 0 0 4px rgba(255, 220, 180, 0.4),
			0 0 8px rgba(255, 180, 100, 0.3);
	}

	.label {
		position: absolute;
		top: calc(100% + 4px);
		font-family: var(--font-mono);
		font-size: 0.5rem;
		color: #f3d6a8;
		text-shadow:
			0 0 2px rgba(8, 6, 14, 0.95),
			0 0 6px rgba(8, 6, 14, 0.7);
		letter-spacing: 0.1em;
		text-transform: lowercase;
		opacity: 0;
		transition: opacity 160ms ease;
		white-space: nowrap;
		pointer-events: none;
	}

	.sigil:hover .label,
	.sigil:focus-visible .label {
		opacity: 1;
	}

	.sigil:hover .dot,
	.sigil:focus-visible .dot {
		filter: brightness(1.6) drop-shadow(0 0 6px rgba(255, 200, 130, 0.9));
	}
</style>
