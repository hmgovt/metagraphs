<script lang="ts">
	type Props = {
		uid: number;
		name: string | null;
		screen: { x: number; y: number };
		onClose: () => void;
	};
	let { uid, name, screen, onClose }: Props = $props();

	const label = $derived(`Subnet ${uid}${name ? ` · ${name}` : ''}, detail coming soon, Phase 2`);
</script>

<div
	class="tooltip"
	style="left: {screen.x}px; top: {screen.y}px;"
	role="dialog"
	aria-modal="false"
	aria-label={label}
>
	<p class="line">
		subnet {uid}{#if name}
			· {name}{/if}
	</p>
	<p class="line dim">detail coming soon · phase 2</p>
	<button class="close" type="button" aria-label="dismiss" onclick={onClose}>×</button>
</div>

<style>
	.tooltip {
		position: fixed;
		transform: translate(-50%, calc(-100% - 14px));
		background: rgba(8, 14, 18, 0.92);
		border: 1px solid rgba(200, 215, 220, 0.18);
		border-radius: 4px;
		padding: 0.45rem 1.5rem 0.45rem 0.65rem;
		font-family: var(--font-mono);
		font-size: 0.7rem;
		letter-spacing: 0.08em;
		text-transform: lowercase;
		color: var(--fg);
		box-shadow: 0 6px 28px rgba(0, 0, 0, 0.6);
		z-index: 10;
		white-space: nowrap;
		max-width: 70vw;
	}

	.line {
		margin: 0;
	}

	.dim {
		color: var(--fg-dim);
		opacity: 0.72;
		margin-top: 0.2rem;
	}

	.close {
		position: absolute;
		top: 4px;
		right: 6px;
		background: transparent;
		border: none;
		color: var(--fg-dim);
		font-size: 1rem;
		line-height: 1;
		padding: 0 4px;
		cursor: pointer;
		opacity: 0.6;
		transition: opacity 150ms ease;
	}

	.close:hover,
	.close:focus-visible {
		opacity: 1;
	}
</style>
