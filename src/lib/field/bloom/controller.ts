/**
 * BloomController — the Three.js + lifecycle orchestrator for the bloom
 * (SPEC §3.9). Holds the per-filament Mesh registry, runs the lifecycle
 * machine each frame, and projects terminal positions for the DOM
 * overlay layer.
 *
 * Field.svelte instantiates this inside its $effect after Three has
 * dynamically loaded; it lives in plain TypeScript so the bloom logic
 * is independent of Svelte 5 runes timing. Field.svelte calls
 *   - hoverEnter(uid, mode) on pointer-enter
 *   - hoverLeave() on pointer-leave (anywhere on the canvas)
 *   - igniteSegment(uid, segmentId) for keyboard or sigil targeting
 *   - update(time, cells) each rAF
 * and renders terminals from the array update() returns.
 */

import type {
	BufferAttribute,
	BufferGeometry as BufferGeometryType,
	Camera,
	Mesh,
	Scene,
	ShaderMaterial as ShaderMaterialType,
	Vector3
} from 'three';
import type { SubnetRow } from '$lib/types/network';
import type { CellSnapshot } from './fields';
import type { FilamentPath } from './physics';
import { computeFilamentPath, bezierPoint } from './physics';
import { SEGMENTS, SEGMENT_BY_ID, type SegmentDef, type SegmentId, type TerminalContent } from './segments';
import { phaseAtTime, FULL_LIFECYCLE_MS, type PhaseState } from './lifecycle';
import { ribbonVertexShader, ribbonFragmentShader } from './shaders';
import {
	RIBBON_SAMPLES,
	RIBBON_HALF_WIDTH_FIELD,
	CASCADE_STAGGER_MS,
	MAX_ACTIVE_FILAMENTS,
	NOISE_FLOOR,
	NOISE_AMPLITUDE_MAX,
	BLOOM_BRIGHTNESS_BOOST,
	BLOOM_BRIGHTNESS_RAMP_MS,
	DECAY_MS,
	SIGIL_ORBIT_FIELD
} from './config';

export type BloomMode = 'cascade' | 'deliberate';

/**
 * Minimal Three.js surface area we need. Field.svelte hands us the
 * actual classes (THREE.* loaded async) plus the live scene + camera.
 * This keeps `controller.ts` free of a hard dependency on Three's import,
 * matching the dynamic-import discipline used elsewhere in the field.
 */
export interface ThreeContext {
	THREE: typeof import('three');
	scene: Scene;
	camera: Camera;
}

interface Filament {
	uid: number;
	segmentId: SegmentId;
	segment: SegmentDef;
	path: FilamentPath;
	ignitedAt: number;
	decayingSince: number | null;
	mesh: Mesh;
	material: ShaderMaterialType;
	subnet: SubnetRow;
	subnetRevision: number;
	twistPhase: number;
}

export interface TerminalState {
	id: string; // `${uid}:${segmentId}` — stable for keyed iteration
	uid: number;
	segmentId: SegmentId;
	screen: { x: number; y: number };
	content: TerminalContent;
	opacity: number;
	emphasisName: boolean; // identity terminal gets heavier border
	/**
	 * Segment's clock-face angle in radians (0 = up; clockwise positive).
	 * Used by BloomTerminal to compute a radial transform so each terminal
	 * sits *away* from the cell — terminals at 3 o'clock anchor on their
	 * left edge; at 9 o'clock on their right edge; at 12 on the bottom;
	 * etc. Keeps text from crashing through the cell.
	 */
	segmentAngle: number;
}

export interface BloomFrameResult {
	terminals: TerminalState[];
	/** Map uid → 0..1 brightness boost the field's main shader should add. */
	cellBoost: Map<number, number>;
	/** Map uid → list of segments to surface as sigils (Mode B only). */
	sigils: SigilState[];
}

export interface SigilState {
	id: string;
	uid: number;
	segmentId: SegmentId;
	screen: { x: number; y: number };
	label: string;
	opacity: number;
}

export class BloomController {
	private THREE: typeof import('three');
	private scene: Scene;
	private camera: Camera;
	/** Shared ribbon geometry — built once, reused by every filament. */
	private geometry: BufferGeometryType;
	private filaments = new Map<string, Filament>();
	/** Subnets, keyed by uid for O(1) lookup. */
	private subnetByUid = new Map<number, SubnetRow>();
	/** Bumped on every applyData; filament terminals re-render their content when it changes. */
	private subnetRevision = 0;
	/** Most recent cells snapshot — used to recompute paths if data churns mid-bloom. */
	private cells: readonly CellSnapshot[] = [];
	/** Reduced-motion preference — checked once at construction. */
	private readonly reducedMotion: boolean;
	/** Mount element used for screen projection. */
	private mount: HTMLElement;
	/** Current hover state. */
	private hoveredUid: number | null = null;
	private hoveredSegmentId: SegmentId | null = null;
	private currentMode: BloomMode = 'cascade';
	private cascadeUid: number | null = null;
	private cascadeStartedAt = 0;
	private boostUid: number | null = null;
	private boostStartedAt = 0;
	private boostFading = false;

	constructor(ctx: ThreeContext, mount: HTMLElement, reducedMotion: boolean) {
		this.THREE = ctx.THREE;
		this.scene = ctx.scene;
		this.camera = ctx.camera;
		this.mount = mount;
		this.reducedMotion = reducedMotion;
		this.geometry = this.buildSharedGeometry();
	}

	private buildSharedGeometry(): BufferGeometryType {
		const T = this.THREE;
		const geometry = new T.BufferGeometry();
		const verts = new Float32Array(RIBBON_SAMPLES * 2 * 3);
		const aT = new Float32Array(RIBBON_SAMPLES * 2);
		const aSide = new Float32Array(RIBBON_SAMPLES * 2);

		for (let i = 0; i < RIBBON_SAMPLES; i++) {
			const t = i / (RIBBON_SAMPLES - 1);
			const idxL = i * 2;
			const idxR = i * 2 + 1;
			aT[idxL] = t;
			aT[idxR] = t;
			aSide[idxL] = -1;
			aSide[idxR] = 1;
		}

		// Indices: triangle strip; converted to triangles for compatibility.
		const indices: number[] = [];
		for (let i = 0; i < RIBBON_SAMPLES - 1; i++) {
			const a = i * 2;
			const b = i * 2 + 1;
			const c = i * 2 + 2;
			const d = i * 2 + 3;
			indices.push(a, b, c, b, d, c);
		}

		geometry.setAttribute('position', new T.BufferAttribute(verts, 3));
		geometry.setAttribute('aT', new T.BufferAttribute(aT, 1));
		geometry.setAttribute('aSide', new T.BufferAttribute(aSide, 1));
		geometry.setIndex(indices);
		return geometry;
	}

	setSubnets(subnets: SubnetRow[]): void {
		this.subnetByUid = new Map(subnets.map((s) => [s.uid, s]));
		this.subnetRevision += 1;
	}

	setCells(cells: readonly CellSnapshot[]): void {
		this.cells = cells;
	}

	setMode(mode: BloomMode): void {
		this.currentMode = mode;
	}

	hoverEnter(uid: number, mode: BloomMode): void {
		if (this.hoveredUid === uid && this.currentMode === mode) return;
		// Different cell: decay any in-progress on the prior cell.
		if (this.hoveredUid !== null && this.hoveredUid !== uid) {
			this.beginDecayForCell(this.hoveredUid);
		}
		this.hoveredUid = uid;
		this.currentMode = mode;
		this.boostUid = uid;
		this.boostStartedAt = performance.now();
		this.boostFading = false;
		if (mode === 'cascade') {
			// Cancel any prior cascade for this cell and re-fire.
			this.cascadeUid = uid;
			this.cascadeStartedAt = performance.now();
			// Cancel any decaying filaments on this cell so the cascade restarts cleanly.
			for (const fil of this.filaments.values()) {
				if (fil.uid === uid) {
					fil.decayingSince = null;
				}
			}
		} else {
			// Deliberate: no auto-ignition. Subsequent hoverSigil() calls
			// will fire individual segments.
			this.cascadeUid = null;
		}
	}

	hoverLeave(): void {
		if (this.hoveredUid !== null) {
			this.beginDecayForCell(this.hoveredUid);
		}
		this.hoveredUid = null;
		this.hoveredSegmentId = null;
		this.cascadeUid = null;
		// Cell boost begins fade-out.
		if (this.boostUid !== null) {
			this.boostFading = true;
			this.boostStartedAt = performance.now();
		}
	}

	/**
	 * In Mode B, the orchestrator forwards each sigil's hover state here.
	 * Called per pointer-move while a cell is focused.
	 */
	hoverSigil(uid: number, segmentId: SegmentId | null): void {
		this.hoveredSegmentId = segmentId;
		if (segmentId === null) return;
		this.ignite(uid, segmentId);
	}

	/**
	 * Force-cascade a cell (right-click or `f` key per the brief, also
	 * `0` keypress). Used by Mode B as the "summon the cinematic" escape
	 * hatch.
	 */
	forceCascade(uid: number): void {
		this.cascadeUid = uid;
		this.cascadeStartedAt = performance.now();
		for (const fil of this.filaments.values()) {
			if (fil.uid === uid) fil.decayingSince = null;
		}
	}

	/** Keyboard 1..8 → segment ignition on the focused cell. */
	igniteSegment(uid: number, segmentId: SegmentId): void {
		this.ignite(uid, segmentId);
	}

	private ignite(uid: number, segmentId: SegmentId): void {
		const subnet = this.subnetByUid.get(uid);
		if (!subnet) return;
		const segment = SEGMENT_BY_ID.get(segmentId);
		if (!segment) return;
		const cell = this.cells[uid];
		if (!cell || cell.alive === 0) return;

		const id = `${uid}:${segmentId}`;
		const existing = this.filaments.get(id);
		if (existing) {
			existing.decayingSince = null;
			existing.subnet = subnet;
			existing.subnetRevision = this.subnetRevision;
			// Re-ignition shifts the start so the moving front re-fires.
			existing.ignitedAt = performance.now();
			return;
		}

		const path = computeFilamentPath(cell, segment, this.cells);
		const material = this.buildMaterial(path);
		const mesh = new this.THREE.Mesh(this.geometry, material);
		mesh.frustumCulled = false;
		this.scene.add(mesh);

		const fil: Filament = {
			uid,
			segmentId,
			segment,
			path,
			ignitedAt: performance.now(),
			decayingSince: null,
			mesh,
			material,
			subnet,
			subnetRevision: this.subnetRevision,
			twistPhase: Math.random() * Math.PI * 2
		};
		this.filaments.set(id, fil);

		this.enforceCap();
	}

	private buildMaterial(path: FilamentPath): ShaderMaterialType {
		const T = this.THREE;
		return new T.ShaderMaterial({
			uniforms: {
				uP0: { value: new T.Vector2(path.p0.x, path.p0.y) },
				uP1: { value: new T.Vector2(path.p1.x, path.p1.y) },
				uP2: { value: new T.Vector2(path.p2.x, path.p2.y) },
				uP3: { value: new T.Vector2(path.p3.x, path.p3.y) },
				uHalfWidth: { value: RIBBON_HALF_WIDTH_FIELD },
				uTwistFreq: { value: path.twistFreq },
				uTwistAmp: { value: path.twistAmp },
				uPhase: { value: 0 },
				uExtent: { value: 0 },
				uFront: { value: 0 },
				uCooling: { value: 0 },
				uBrightness: { value: 0 },
				uCleanCool: { value: path.cleanCool },
				uNoiseFloor: { value: NOISE_FLOOR },
				uNoiseAmpMax: { value: NOISE_AMPLITUDE_MAX },
				uTime: { value: 0 }
			},
			vertexShader: ribbonVertexShader,
			fragmentShader: ribbonFragmentShader,
			blending: T.AdditiveBlending,
			depthWrite: false,
			transparent: true
		});
	}

	private beginDecayForCell(uid: number): void {
		const now = performance.now();
		for (const fil of this.filaments.values()) {
			if (fil.uid === uid && fil.decayingSince === null) {
				fil.decayingSince = now;
			}
		}
	}

	private enforceCap(): void {
		while (this.filaments.size > MAX_ACTIVE_FILAMENTS) {
			// Decay the oldest non-decaying filament.
			let oldestKey: string | null = null;
			let oldestT = Infinity;
			for (const [k, f] of this.filaments) {
				if (f.decayingSince !== null) continue;
				if (f.ignitedAt < oldestT) {
					oldestT = f.ignitedAt;
					oldestKey = k;
				}
			}
			if (oldestKey === null) break;
			const f = this.filaments.get(oldestKey);
			if (f) f.decayingSince = performance.now();
		}
	}

	/**
	 * Tick the lifecycle and produce render state for terminals + sigils.
	 * Called once per rAF from Field.svelte.
	 */
	update(timeSec: number, cells: readonly CellSnapshot[]): BloomFrameResult {
		this.cells = cells;
		const now = performance.now();

		// Mode A cascade: ignite each segment in clock order at staggered times.
		if (this.cascadeUid !== null) {
			const dt = now - this.cascadeStartedAt;
			for (let i = 0; i < SEGMENTS.length; i++) {
				const want = i * CASCADE_STAGGER_MS;
				if (dt < want) continue;
				const seg = SEGMENTS[i];
				const id = `${this.cascadeUid}:${seg.id}`;
				if (!this.filaments.has(id)) {
					this.ignite(this.cascadeUid, seg.id);
				}
			}
			if (dt >= (SEGMENTS.length - 1) * CASCADE_STAGGER_MS + FULL_LIFECYCLE_MS) {
				// Cascade complete; keep filaments sustained until hover-leave.
				this.cascadeUid = null;
			}
		}

		const terminals: TerminalState[] = [];
		const sigils: SigilState[] = [];
		const cellBoost = new Map<number, number>();

		// Per-filament tick.
		const toRemove: string[] = [];
		for (const [key, fil] of this.filaments) {
			const elapsed = now - fil.ignitedAt;
			const decayingSince = fil.decayingSince !== null ? now - fil.decayingSince : null;
			const phase = phaseAtTime(elapsed, decayingSince, this.reducedMotion);

			if (phase.phase === 'extinct') {
				toRemove.push(key);
				continue;
			}

			// Refresh subnet data if it churned (snapshot refresh while sustained).
			const live = this.subnetByUid.get(fil.uid);
			if (live && fil.subnetRevision !== this.subnetRevision) {
				fil.subnet = live;
				fil.subnetRevision = this.subnetRevision;
			}

			const u = fil.material.uniforms;
			fil.twistPhase += 0.6 * (1 / 60); // ~0.6 rad/s
			u.uPhase.value = fil.twistPhase;
			u.uExtent.value = phase.extent;
			u.uFront.value = phase.front;
			u.uCooling.value = phase.cooling;
			u.uBrightness.value = phase.brightness;
			u.uTime.value = timeSec;

			if (phase.terminalOpacity > 0) {
				const screen = this.projectPoint(fil.path.p3);
				if (screen) {
					terminals.push({
						id: key,
						uid: fil.uid,
						segmentId: fil.segmentId,
						screen,
						content: fil.segment.render(fil.subnet),
						opacity: phase.terminalOpacity,
						emphasisName: fil.segmentId === 'identity',
						segmentAngle: fil.segment.angle
					});
				}
			}
		}

		for (const key of toRemove) {
			const fil = this.filaments.get(key)!;
			this.scene.remove(fil.mesh);
			fil.material.dispose();
			this.filaments.delete(key);
		}

		// Sigils — Mode B only, around the currently hovered cell. Orbit
		// is a fixed field-space radius so they fan evenly regardless of
		// cell size.
		if (this.currentMode === 'deliberate' && this.hoveredUid !== null) {
			const cell = this.cells[this.hoveredUid];
			if (cell && cell.alive === 1) {
				for (const seg of SEGMENTS) {
					const sx = cell.x + Math.sin(seg.angle) * SIGIL_ORBIT_FIELD;
					const sy = cell.y + Math.cos(seg.angle) * SIGIL_ORBIT_FIELD;
					const screen = this.projectPoint({ x: sx, y: sy });
					if (!screen) continue;
					sigils.push({
						id: `${this.hoveredUid}:${seg.id}:sigil`,
						uid: this.hoveredUid,
						segmentId: seg.id,
						screen,
						label: seg.sigilLabel,
						opacity: 1
					});
				}
			}
		}

		// Cell brightness boost for the focused cell.
		if (this.boostUid !== null) {
			const dt = now - this.boostStartedAt;
			let boost: number;
			if (this.boostFading) {
				const p = Math.min(1, dt / DECAY_MS);
				boost = BLOOM_BRIGHTNESS_BOOST * (1 - p);
				if (p >= 1) {
					this.boostUid = null;
					boost = 0;
				}
			} else {
				const p = Math.min(1, dt / BLOOM_BRIGHTNESS_RAMP_MS);
				boost = BLOOM_BRIGHTNESS_BOOST * p;
			}
			if (boost > 0 && this.boostUid !== null) {
				cellBoost.set(this.boostUid, boost);
			}
		}

		return { terminals, sigils, cellBoost };
	}

	private projectPoint(p: { x: number; y: number }): { x: number; y: number } | null {
		const rect = this.mount.getBoundingClientRect();
		if (rect.width === 0 || rect.height === 0) return null;
		const v: Vector3 = new this.THREE.Vector3(p.x, p.y, 0);
		v.project(this.camera);
		if (!Number.isFinite(v.x) || !Number.isFinite(v.y)) return null;
		return {
			x: rect.left + ((v.x + 1) / 2) * rect.width,
			y: rect.top + ((1 - v.y) / 2) * rect.height
		};
	}

	dispose(): void {
		for (const fil of this.filaments.values()) {
			this.scene.remove(fil.mesh);
			fil.material.dispose();
		}
		this.filaments.clear();
		this.geometry.dispose();
	}
}
