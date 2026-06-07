<script lang="ts">
	import { networkStore } from '$lib/state/network.svelte';
	import type { NetworkJson } from '$lib/types/network';
	import { positionForUid } from './positions';
	import { vertexShader, fragmentShader } from './shaders';
	import {
		MAX_SUBNETS,
		R_MIN,
		R_MAX,
		EMISSION_REF,
		INTENSITY_BASELINE,
		INTENSITY_EXTRA,
		BREATHE_PERIOD_SEC,
		BREATHE_AMPLITUDE,
		TEMP_STAGE4_DEFAULT,
		PHI,
		HIT_RADIUS_MULTIPLIER,
		HIT_RADIUS_FLOOR
	} from './config';
	import SubnetTooltip from './SubnetTooltip.svelte';

	type Props = {
		ariaLabel?: string;
	};
	let { ariaLabel = 'Network field of subnets' }: Props = $props();

	let container = $state<HTMLDivElement | undefined>();
	let tooltipUid = $state<number | null>(null);
	let tooltipName = $state<string | null>(null);
	let tooltipScreen = $state<{ x: number; y: number } | null>(null);

	type CellState = {
		uid: number;
		x: number;
		y: number;
		radius: number;
		alive: number;
	};

	const cells: CellState[] = Array.from({ length: MAX_SUBNETS }, (_, uid) => {
		const [x, y] = positionForUid(uid);
		return { uid, x, y, radius: R_MIN, alive: 0 };
	});

	let applyData: ((d: NetworkJson | null) => void) | null = null;
	let projectCell: ((uid: number) => { x: number; y: number } | null) | null = null;

	function clearTooltip() {
		tooltipUid = null;
		tooltipName = null;
		tooltipScreen = null;
	}

	function openTooltip(uid: number) {
		if (!projectCell) return;
		const screen = projectCell(uid);
		if (!screen) return;
		const subnet = networkStore.data?.subnets.find((s) => s.uid === uid) ?? null;
		tooltipUid = uid;
		tooltipName = subnet?.name ?? null;
		tooltipScreen = screen;
	}

	$effect(() => {
		if (!container || typeof window === 'undefined') return;

		const mount = container;
		let disposed = false;
		let cleanup: (() => void) | null = null;

		(async () => {
			const THREE = await import('three');
			if (disposed) return;

			const canvas = document.createElement('canvas');
			canvas.style.width = '100%';
			canvas.style.height = '100%';
			canvas.style.display = 'block';
			canvas.setAttribute('aria-label', ariaLabel);
			mount.appendChild(canvas);

			const renderer = new THREE.WebGLRenderer({
				canvas,
				antialias: true,
				alpha: true,
				powerPreference: 'high-performance'
			});
			renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
			renderer.setClearColor(0x000000, 0);

			let { width, height } = mount.getBoundingClientRect();
			if (width === 0 || height === 0) {
				width = window.innerWidth;
				height = window.innerHeight;
			}
			let aspect = width / height;
			renderer.setSize(width, height, false);

			const scene = new THREE.Scene();
			const camera = new THREE.OrthographicCamera(-aspect, aspect, 1, -1, -1, 1);

			const plane = new THREE.PlaneGeometry(1, 1);
			const geometry = new THREE.InstancedBufferGeometry();
			geometry.index = plane.index;
			geometry.setAttribute('position', plane.attributes.position);
			geometry.setAttribute('uv', plane.attributes.uv);

			const aPosition = new Float32Array(MAX_SUBNETS * 2);
			const aRadius = new Float32Array(MAX_SUBNETS);
			const aIntensity = new Float32Array(MAX_SUBNETS);
			const aTemperature = new Float32Array(MAX_SUBNETS);
			const aPhase = new Float32Array(MAX_SUBNETS);
			const aAlive = new Float32Array(MAX_SUBNETS);

			for (let uid = 0; uid < MAX_SUBNETS; uid++) {
				const cell = cells[uid];
				aPosition[uid * 2] = cell.x;
				aPosition[uid * 2 + 1] = cell.y;
				aRadius[uid] = R_MIN;
				aIntensity[uid] = INTENSITY_BASELINE;
				aTemperature[uid] = TEMP_STAGE4_DEFAULT;
				aPhase[uid] = ((uid * PHI) % 1) * Math.PI * 2;
				aAlive[uid] = 0;
			}

			const aPositionAttr = new THREE.InstancedBufferAttribute(aPosition, 2);
			const aRadiusAttr = new THREE.InstancedBufferAttribute(aRadius, 1);
			const aIntensityAttr = new THREE.InstancedBufferAttribute(aIntensity, 1);
			const aTemperatureAttr = new THREE.InstancedBufferAttribute(aTemperature, 1);
			const aPhaseAttr = new THREE.InstancedBufferAttribute(aPhase, 1);
			const aAliveAttr = new THREE.InstancedBufferAttribute(aAlive, 1);

			geometry.setAttribute('aPosition', aPositionAttr);
			geometry.setAttribute('aRadius', aRadiusAttr);
			geometry.setAttribute('aIntensity', aIntensityAttr);
			geometry.setAttribute('aTemperature', aTemperatureAttr);
			geometry.setAttribute('aPhase', aPhaseAttr);
			geometry.setAttribute('aAlive', aAliveAttr);
			geometry.instanceCount = MAX_SUBNETS;

			const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

			const material = new THREE.ShaderMaterial({
				uniforms: {
					uTime: { value: 0 },
					uBreatheAmp: { value: reducedMotion ? 0 : BREATHE_AMPLITUDE },
					uBreatheFreq: { value: (Math.PI * 2) / BREATHE_PERIOD_SEC }
				},
				vertexShader,
				fragmentShader,
				blending: THREE.AdditiveBlending,
				depthWrite: false,
				transparent: true
			});

			const mesh = new THREE.Mesh(geometry, material);
			scene.add(mesh);

			const presentScratch = new Uint8Array(MAX_SUBNETS);

			function applyDataImpl(data: NetworkJson | null) {
				if (!data) {
					for (let uid = 0; uid < MAX_SUBNETS; uid++) {
						const cell = cells[uid];
						aAlive[uid] = 0;
						aRadius[uid] = R_MIN;
						aIntensity[uid] = INTENSITY_BASELINE;
						cell.alive = 0;
						cell.radius = R_MIN;
					}
				} else {
					presentScratch.fill(0);
					for (const subnet of data.subnets) {
						if (subnet.uid < 0 || subnet.uid >= MAX_SUBNETS) continue;
						presentScratch[subnet.uid] = 1;
						const share = subnet.emissionShare ?? 0;
						const t = Math.min(share / EMISSION_REF, 1);
						const root = Math.sqrt(t);
						const radius = R_MIN + (R_MAX - R_MIN) * root;
						const intensity = INTENSITY_BASELINE + INTENSITY_EXTRA * root;

						aRadius[subnet.uid] = radius;
						aIntensity[subnet.uid] = intensity;
						aAlive[subnet.uid] = 1;

						const cell = cells[subnet.uid];
						cell.radius = radius;
						cell.alive = 1;
					}
					for (let uid = 0; uid < MAX_SUBNETS; uid++) {
						if (presentScratch[uid] === 0) {
							aRadius[uid] = R_MIN;
							aIntensity[uid] = INTENSITY_BASELINE;
							aAlive[uid] = 0;
							cells[uid].radius = R_MIN;
							cells[uid].alive = 0;
						}
					}
				}
				aRadiusAttr.needsUpdate = true;
				aIntensityAttr.needsUpdate = true;
				aAliveAttr.needsUpdate = true;
			}

			applyData = applyDataImpl;
			applyDataImpl(networkStore.data);

			function projectCellImpl(uid: number): { x: number; y: number } | null {
				const cell = cells[uid];
				if (!cell || cell.alive === 0) return null;
				const rect = mount.getBoundingClientRect();
				const ndcX = cell.x / aspect;
				const ndcY = cell.y;
				const x = rect.left + ((ndcX + 1) / 2) * rect.width;
				const y = rect.top + ((1 - ndcY) / 2) * rect.height;
				return { x, y };
			}
			projectCell = projectCellImpl;

			function pickAtPointer(clientX: number, clientY: number): number | null {
				const rect = mount.getBoundingClientRect();
				if (rect.width === 0 || rect.height === 0) return null;
				const ndcX = ((clientX - rect.left) / rect.width) * 2 - 1;
				const ndcY = -((clientY - rect.top) / rect.height) * 2 + 1;
				const fieldX = ndcX * aspect;
				const fieldY = ndcY;

				let nearestUid: number | null = null;
				let nearestDistSq = Infinity;
				for (let uid = 0; uid < MAX_SUBNETS; uid++) {
					const cell = cells[uid];
					if (cell.alive === 0) continue;
					const dx = cell.x - fieldX;
					const dy = cell.y - fieldY;
					const distSq = dx * dx + dy * dy;
					const hitR = Math.max(cell.radius * HIT_RADIUS_MULTIPLIER, HIT_RADIUS_FLOOR);
					if (distSq < hitR * hitR && distSq < nearestDistSq) {
						nearestDistSq = distSq;
						nearestUid = uid;
					}
				}
				return nearestUid;
			}

			function onPointerMove(e: PointerEvent) {
				const uid = pickAtPointer(e.clientX, e.clientY);
				canvas.style.cursor = uid !== null ? 'pointer' : 'default';
			}

			function onClick(e: MouseEvent) {
				const uid = pickAtPointer(e.clientX, e.clientY);
				if (uid === null) {
					clearTooltip();
				} else {
					openTooltip(uid);
				}
			}

			function onKeydown(e: KeyboardEvent) {
				if (e.key === 'Escape') clearTooltip();
			}

			function onScroll() {
				clearTooltip();
			}

			canvas.addEventListener('pointermove', onPointerMove);
			canvas.addEventListener('click', onClick);
			window.addEventListener('keydown', onKeydown);
			window.addEventListener('scroll', onScroll, { passive: true });

			const start = performance.now();
			let rafId: number | null = null;
			function frame() {
				material.uniforms.uTime.value = (performance.now() - start) / 1000;
				renderer.render(scene, camera);
				rafId = requestAnimationFrame(frame);
			}
			frame();

			const resizeObserver = new ResizeObserver((entries) => {
				for (const entry of entries) {
					const r = entry.contentRect;
					if (r.width === 0 || r.height === 0) continue;
					width = r.width;
					height = r.height;
					aspect = width / height;
					renderer.setSize(width, height, false);
					camera.left = -aspect;
					camera.right = aspect;
					camera.top = 1;
					camera.bottom = -1;
					camera.updateProjectionMatrix();
					clearTooltip();
				}
			});
			resizeObserver.observe(mount);

			cleanup = () => {
				if (rafId !== null) cancelAnimationFrame(rafId);
				resizeObserver.disconnect();
				canvas.removeEventListener('pointermove', onPointerMove);
				canvas.removeEventListener('click', onClick);
				window.removeEventListener('keydown', onKeydown);
				window.removeEventListener('scroll', onScroll);
				geometry.dispose();
				material.dispose();
				plane.dispose();
				renderer.dispose();
				if (canvas.parentNode === mount) mount.removeChild(canvas);
				applyData = null;
				projectCell = null;
			};
		})();

		return () => {
			disposed = true;
			clearTooltip();
			cleanup?.();
		};
	});

	$effect(() => {
		const data = networkStore.data;
		applyData?.(data);
	});
</script>

<div bind:this={container} class="field-mount" role="presentation"></div>

{#if tooltipUid !== null && tooltipScreen !== null}
	<SubnetTooltip
		uid={tooltipUid}
		name={tooltipName}
		screen={tooltipScreen}
		onClose={clearTooltip}
	/>
{/if}

<p class="sr-only" aria-live="polite">
	{#if networkStore.data}
		Bittensor network field, {networkStore.data.totalSubnets} subnets, source {networkStore.data
			.source}, as of {networkStore.data.asOf}.
	{:else if networkStore.error}
		Bittensor network field, data unreachable.
	{:else}
		Bittensor network field, loading.
	{/if}
</p>

<style>
	.field-mount {
		position: absolute;
		inset: 0;
		width: 100%;
		height: 100%;
	}

	.sr-only {
		position: absolute;
		width: 1px;
		height: 1px;
		padding: 0;
		margin: -1px;
		overflow: hidden;
		clip: rect(0, 0, 0, 0);
		white-space: nowrap;
		border: 0;
	}
</style>
