<script lang="ts">
	import { networkStore } from '$lib/state/network.svelte';
	import type { NetworkJson } from '$lib/types/network';
	import { positionForUid } from './positions';
	import { vertexShader, fragmentShader } from './shaders';
	import { temperatureFor } from './temperature';
	import {
		MAX_SUBNETS,
		R_MIN,
		R_MAX,
		EMISSION_REF,
		INTENSITY_BASELINE,
		INTENSITY_EXTRA,
		BREATHE_PERIOD_SEC,
		BREATHE_AMPLITUDE,
		TEMPERATURE_NEUTRAL,
		PHI,
		HIT_RADIUS_MULTIPLIER,
		HIT_RADIUS_FLOOR,
		MIN_ZOOM,
		MAX_ZOOM,
		ZOOM_STEP,
		NAME_LABEL_ZOOM_THRESHOLD,
		ZOOM_TWEEN_MS
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

	// Names visible at zoom — kept in $state so the DOM updates in lockstep.
	type LabelState = { uid: number; name: string; x: number; y: number; opacity: number };
	let labels = $state<LabelState[]>([]);

	type CellState = {
		uid: number;
		x: number;
		y: number;
		radius: number;
		alive: number;
		name: string | null;
		emissionShare: number;
	};

	const cells: CellState[] = Array.from({ length: MAX_SUBNETS }, (_, uid) => {
		const [x, y] = positionForUid(uid);
		return { uid, x, y, radius: R_MIN, alive: 0, name: null, emissionShare: 0 };
	});

	let applyData: ((d: NetworkJson | null) => void) | null = null;
	let projectCell: ((uid: number) => { x: number; y: number } | null) | null = null;
	let zoomToCell: ((uid: number) => void) | null = null;

	function clearTooltip() {
		tooltipUid = null;
		tooltipName = null;
		tooltipScreen = null;
	}

	function openTooltip(uid: number) {
		if (!projectCell) return;
		const screen = projectCell(uid);
		if (!screen) return;
		const cell = cells[uid];
		tooltipUid = uid;
		tooltipName = cell.name;
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
			canvas.style.touchAction = 'none';
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
			camera.zoom = MIN_ZOOM;
			camera.position.set(0, 0, 0);
			camera.updateProjectionMatrix();

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
				aTemperature[uid] = TEMPERATURE_NEUTRAL;
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
						aTemperature[uid] = TEMPERATURE_NEUTRAL;
						cell.alive = 0;
						cell.radius = R_MIN;
						cell.name = null;
						cell.emissionShare = 0;
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
						const temperature = temperatureFor(subnet);

						aRadius[subnet.uid] = radius;
						aIntensity[subnet.uid] = intensity;
						aTemperature[subnet.uid] = temperature;
						aAlive[subnet.uid] = 1;

						const cell = cells[subnet.uid];
						cell.radius = radius;
						cell.alive = 1;
						cell.name = subnet.name;
						cell.emissionShare = share;
					}
					for (let uid = 0; uid < MAX_SUBNETS; uid++) {
						if (presentScratch[uid] === 0) {
							aRadius[uid] = R_MIN;
							aIntensity[uid] = INTENSITY_BASELINE;
							aTemperature[uid] = TEMPERATURE_NEUTRAL;
							aAlive[uid] = 0;
							cells[uid].radius = R_MIN;
							cells[uid].alive = 0;
							cells[uid].name = null;
							cells[uid].emissionShare = 0;
						}
					}
				}
				aRadiusAttr.needsUpdate = true;
				aIntensityAttr.needsUpdate = true;
				aTemperatureAttr.needsUpdate = true;
				aAliveAttr.needsUpdate = true;
			}

			applyData = applyDataImpl;
			applyDataImpl(networkStore.data);

			function clampCameraPosition() {
				// At higher zoom, the visible half-width shrinks (1/zoom). Allow the
				// camera centre to wander only as far as keeps SOME of the field in
				// view — never let the viewer lose the organism.
				const halfX = aspect / camera.zoom;
				const halfY = 1 / camera.zoom;
				const maxX = Math.max(0, 0.9 - halfX * 0.5);
				const maxY = Math.max(0, 0.9 - halfY * 0.5);
				camera.position.x = Math.max(-maxX, Math.min(maxX, camera.position.x));
				camera.position.y = Math.max(-maxY, Math.min(maxY, camera.position.y));
			}

			function projectCellImpl(uid: number): { x: number; y: number } | null {
				const cell = cells[uid];
				if (!cell || cell.alive === 0) return null;
				const rect = mount.getBoundingClientRect();
				const v = new THREE.Vector3(cell.x, cell.y, 0).project(camera);
				const x = rect.left + ((v.x + 1) / 2) * rect.width;
				const y = rect.top + ((1 - v.y) / 2) * rect.height;
				return { x, y };
			}
			projectCell = projectCellImpl;

			function pickAtPointer(clientX: number, clientY: number): number | null {
				const rect = mount.getBoundingClientRect();
				if (rect.width === 0 || rect.height === 0) return null;
				const ndcX = ((clientX - rect.left) / rect.width) * 2 - 1;
				const ndcY = -((clientY - rect.top) / rect.height) * 2 + 1;
				const v = new THREE.Vector3(ndcX, ndcY, 0).unproject(camera);
				const fieldX = v.x;
				const fieldY = v.y;

				let nearestUid: number | null = null;
				let nearestDistSq = Infinity;
				const hitScale = Math.max(0.4, 1 / camera.zoom); // tighter hits when zoomed in
				for (let uid = 0; uid < MAX_SUBNETS; uid++) {
					const cell = cells[uid];
					if (cell.alive === 0) continue;
					const dx = cell.x - fieldX;
					const dy = cell.y - fieldY;
					const distSq = dx * dx + dy * dy;
					const hitR = Math.max(cell.radius * HIT_RADIUS_MULTIPLIER, HIT_RADIUS_FLOOR) * hitScale;
					if (distSq < hitR * hitR && distSq < nearestDistSq) {
						nearestDistSq = distSq;
						nearestUid = uid;
					}
				}
				return nearestUid;
			}

			function ndcAtPointer(clientX: number, clientY: number): { x: number; y: number } | null {
				const rect = mount.getBoundingClientRect();
				if (rect.width === 0 || rect.height === 0) return null;
				const ndcX = ((clientX - rect.left) / rect.width) * 2 - 1;
				const ndcY = -((clientY - rect.top) / rect.height) * 2 + 1;
				return { x: ndcX, y: ndcY };
			}

			function zoomAtPointer(clientX: number, clientY: number, factor: number) {
				const ndc = ndcAtPointer(clientX, clientY);
				if (!ndc) return;
				const before = new THREE.Vector3(ndc.x, ndc.y, 0).unproject(camera);

				const next = Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, camera.zoom * factor));
				if (next === camera.zoom) return;
				camera.zoom = next;
				camera.updateProjectionMatrix();

				const after = new THREE.Vector3(ndc.x, ndc.y, 0).unproject(camera);
				camera.position.x += before.x - after.x;
				camera.position.y += before.y - after.y;

				if (camera.zoom <= MIN_ZOOM + 1e-3) {
					camera.position.set(0, 0, 0);
				} else {
					clampCameraPosition();
				}
				camera.updateProjectionMatrix();
				clearTooltip();
			}

			type ZoomTween = {
				fromZoom: number;
				toZoom: number;
				fromX: number;
				fromY: number;
				toX: number;
				toY: number;
				t0: number;
			};
			let zoomTween: ZoomTween | null = null;

			function tweenZoomTo(targetZoom: number, targetX: number, targetY: number) {
				zoomTween = {
					fromZoom: camera.zoom,
					toZoom: targetZoom,
					fromX: camera.position.x,
					fromY: camera.position.y,
					toX: targetX,
					toY: targetY,
					t0: performance.now()
				};
			}

			zoomToCell = (uid: number) => {
				const cell = cells[uid];
				if (!cell || cell.alive === 0) return;
				tweenZoomTo(Math.min(MAX_ZOOM, 3.5), cell.x, cell.y);
			};

			function resetZoom() {
				tweenZoomTo(MIN_ZOOM, 0, 0);
			}

			function applyTweenFrame() {
				if (!zoomTween) return;
				const t = zoomTween;
				const p = Math.min(1, (performance.now() - t.t0) / ZOOM_TWEEN_MS);
				// easeOutCubic
				const e = 1 - Math.pow(1 - p, 3);
				camera.zoom = t.fromZoom + (t.toZoom - t.fromZoom) * e;
				camera.position.x = t.fromX + (t.toX - t.fromX) * e;
				camera.position.y = t.fromY + (t.toY - t.fromY) * e;
				camera.updateProjectionMatrix();
				clampCameraPosition();
				if (p >= 1) {
					zoomTween = null;
				}
			}

			function updateLabels() {
				if (camera.zoom < NAME_LABEL_ZOOM_THRESHOLD) {
					if (labels.length > 0) labels = [];
					return;
				}
				const fade = Math.min(
					1,
					(camera.zoom - NAME_LABEL_ZOOM_THRESHOLD) / (NAME_LABEL_ZOOM_THRESHOLD * 0.4)
				);
				const rect = mount.getBoundingClientRect();
				const next: LabelState[] = [];
				for (let uid = 0; uid < MAX_SUBNETS; uid++) {
					const cell = cells[uid];
					if (cell.alive === 0 || cell.emissionShare <= 0) continue;
					if (!cell.name) continue;
					const v = new THREE.Vector3(cell.x, cell.y, 0).project(camera);
					if (v.x < -1.05 || v.x > 1.05 || v.y < -1.05 || v.y > 1.05) continue;
					next.push({
						uid,
						name: cell.name,
						x: rect.left + ((v.x + 1) / 2) * rect.width,
						y: rect.top + ((1 - v.y) / 2) * rect.height,
						opacity: fade
					});
				}
				labels = next;
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

			function onDblClick(e: MouseEvent) {
				const uid = pickAtPointer(e.clientX, e.clientY);
				if (uid !== null) {
					zoomToCell?.(uid);
				} else {
					resetZoom();
				}
			}

			function onWheel(e: WheelEvent) {
				e.preventDefault();
				// Pinch on macOS trackpad fires wheel with ctrlKey + small deltaY.
				const delta = e.deltaY;
				if (delta === 0) return;
				const factor = delta < 0 ? ZOOM_STEP : 1 / ZOOM_STEP;
				zoomAtPointer(e.clientX, e.clientY, factor);
			}

			function onKeydown(e: KeyboardEvent) {
				if (e.key === 'Escape') {
					if (camera.zoom > MIN_ZOOM + 1e-3) {
						resetZoom();
					} else {
						clearTooltip();
					}
				}
				if (e.key === '0' || e.key === 'Home') {
					resetZoom();
				}
			}

			function onScroll() {
				clearTooltip();
			}

			canvas.addEventListener('pointermove', onPointerMove);
			canvas.addEventListener('click', onClick);
			canvas.addEventListener('dblclick', onDblClick);
			canvas.addEventListener('wheel', onWheel, { passive: false });
			window.addEventListener('keydown', onKeydown);
			window.addEventListener('scroll', onScroll, { passive: true });

			const start = performance.now();
			let rafId: number | null = null;
			function frame() {
				material.uniforms.uTime.value = (performance.now() - start) / 1000;
				applyTweenFrame();
				renderer.render(scene, camera);
				updateLabels();
				if (tooltipUid !== null && projectCell) {
					const s = projectCell(tooltipUid);
					if (s) tooltipScreen = s;
				}
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
				canvas.removeEventListener('dblclick', onDblClick);
				canvas.removeEventListener('wheel', onWheel);
				window.removeEventListener('keydown', onKeydown);
				window.removeEventListener('scroll', onScroll);
				geometry.dispose();
				material.dispose();
				plane.dispose();
				renderer.dispose();
				if (canvas.parentNode === mount) mount.removeChild(canvas);
				applyData = null;
				projectCell = null;
				zoomToCell = null;
			};
		})();

		return () => {
			disposed = true;
			clearTooltip();
			labels = [];
			cleanup?.();
		};
	});

	$effect(() => {
		const data = networkStore.data;
		applyData?.(data);
	});
</script>

<div bind:this={container} class="field-mount" role="presentation"></div>

{#each labels as label (label.uid)}
	<span class="cell-label" style="left: {label.x}px; top: {label.y}px; opacity: {label.opacity};">
		{label.name}
	</span>
{/each}

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
			.source}, as of {networkStore.data.asOf}. Use the scroll wheel to zoom; double-click a cell to
		zoom to it; press Escape or 0 to reset.
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

	.cell-label {
		position: fixed;
		transform: translate(-50%, calc(100% + 6px));
		pointer-events: none;
		font-family: var(--font-mono);
		font-size: 0.62rem;
		letter-spacing: 0.1em;
		text-transform: lowercase;
		color: var(--fg);
		text-shadow: 0 0 8px rgba(8, 14, 18, 0.95);
		white-space: nowrap;
		z-index: 5;
		transition: opacity 200ms ease;
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
