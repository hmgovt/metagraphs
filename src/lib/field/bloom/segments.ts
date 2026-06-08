/**
 * The eight canonical segments per cell (SPEC §3.9). Same clock
 * positions across every subnet — geography is learnable.
 *
 * Each segment has a stable id (used by Mode B keyboard shortcuts 1-8
 * and the sigil registry), an angular position around the cell (radians,
 * 0 = up = 12 o'clock, clockwise positive), a label used as a tooltip
 * for the sigil, a length-driver code consumed by physics.ts, and a
 * pure renderer that produces the terminal's text content from a
 * SubnetRow.
 *
 * The renderer returns a plain shape (lines + optional links) rather
 * than HTML; BloomTerminal.svelte is the only place HTML rendering
 * happens. This keeps segments.ts pure and unit-testable.
 */

import type { SubnetRow } from '$lib/types/network';
import {
	EMISSION_FILAMENT_BASE,
	EMISSION_FILAMENT_SCALE,
	AGE_FILAMENT_BASE,
	AGE_FILAMENT_SCALE,
	TREND_FILAMENT_BASE,
	TREND_FILAMENT_SCALE,
	CONSTANT_FILAMENT_LENGTH
} from './config';

export type SegmentId =
	| 'identity'
	| 'purpose'
	| 'emission'
	| 'signal'
	| 'age'
	| 'trend'
	| 'network'
	| 'links';

export interface TerminalLine {
	text: string;
	/** Identity segment renders the name with a heavier diffuse border. */
	emphasis?: 'name' | 'value' | 'detail';
	/** Optional external link — terminal renders it as `<a target="_blank">`. */
	href?: string;
}

export interface TerminalContent {
	lines: TerminalLine[];
	/** Logo URL for the Identity segment, when present. */
	logoUrl?: string | null;
}

export interface SegmentDef {
	id: SegmentId;
	keyboardIndex: number; // 1-8 corresponds to keyboard shortcut
	/** Clock-face angle in radians. 0 = up; clockwise positive. */
	angle: number;
	sigilLabel: string;
	lengthFor(subnet: SubnetRow): number;
	render(subnet: SubnetRow): TerminalContent;
}

/** Total daily TAO emission after the December-2025 halving. */
const TAO_PER_DAY_NETWORK = 3_600;

function fmtPct(value: number | null | undefined, decimals = 2): string {
	if (value === null || value === undefined || !Number.isFinite(value)) return '—';
	return `${(value * 100).toFixed(decimals)}%`;
}

function fmtTaoPerDay(share: number | null | undefined): string {
	if (share === null || share === undefined || !Number.isFinite(share)) return '—';
	const tao = share * TAO_PER_DAY_NETWORK;
	if (tao >= 1000) return `${Math.round(tao).toLocaleString()} TAO/d`;
	if (tao >= 10) return `${tao.toFixed(0)} TAO/d`;
	return `${tao.toFixed(2)} TAO/d`;
}

function fmtDays(days: number | null | undefined): string {
	if (days === null || days === undefined || !Number.isFinite(days)) return '—';
	if (days < 1) return 'today';
	if (days < 7) return `${Math.round(days)} d`;
	if (days < 90) return `${Math.round(days)} days`;
	if (days < 730) {
		const months = days / 30.44;
		return `${months.toFixed(1)} months`;
	}
	return `${(days / 365.25).toFixed(1)} years`;
}

function ageCohort(days: number | null | undefined): string {
	if (days === null || days === undefined) return 'unknown cohort';
	if (days < 14) return 'fresh';
	if (days < 90) return 'recent';
	if (days < 365) return 'established';
	return 'veteran';
}

function fmtArrow(delta: number | null | undefined): string {
	if (delta === null || delta === undefined || !Number.isFinite(delta)) return '—';
	if (delta > 0.0001) return '↑';
	if (delta < -0.0001) return '↓';
	return '·';
}

function signalNarrative(subnet: SubnetRow): string {
	const s = subnet.realRevenueSignal;
	if (s === null || s === undefined || !Number.isFinite(s)) {
		return 'signal — labelled neutral · honesty data missing';
	}
	if (s >= 0.7) return `honest revenue · signal ${s.toFixed(2)}`;
	if (s >= 0.4) return `mixed signal · ${s.toFixed(2)}`;
	if (s >= 0.15) return `weak demand · signal ${s.toFixed(2)}`;
	return `subsidy-farming · signal ${s.toFixed(2)}`;
}

function fmtRankDelta(delta: number | null | undefined): string {
	if (delta === null || delta === undefined || !Number.isFinite(delta)) return 'rank — no signal yet';
	if (delta === 0) return 'rank steady';
	if (delta > 0) return `↑ ${delta} places vs 24h`;
	return `↓ ${Math.abs(delta)} places vs 24h`;
}

/**
 * The eight canonical segments. Angles arranged clockwise from 12:00,
 * 45° apart (π/4). Order in this array matches the clock and matches the
 * cascade ignition order in Mode A.
 */
export const SEGMENTS: readonly SegmentDef[] = [
	{
		id: 'identity',
		keyboardIndex: 1,
		angle: 0, // 12:00
		sigilLabel: 'identity',
		lengthFor: () => CONSTANT_FILAMENT_LENGTH,
		render(subnet) {
			const name = subnet.name ?? `subnet ${subnet.uid}`;
			return {
				logoUrl: subnet.logoUrl ?? null,
				lines: [
					{ text: name, emphasis: 'name' },
					{ text: `uid ${subnet.uid}`, emphasis: 'detail' }
				]
			};
		}
	},
	{
		id: 'purpose',
		keyboardIndex: 2,
		angle: Math.PI / 4, // 1:30
		sigilLabel: 'purpose',
		lengthFor: () => CONSTANT_FILAMENT_LENGTH,
		render(subnet) {
			const d = subnet.description ?? null;
			if (!d) {
				return { lines: [{ text: 'purpose — owner has not described', emphasis: 'detail' }] };
			}
			// Trim to ~140 chars to keep the terminal compact; full text in the link if present.
			const trimmed = d.length > 140 ? d.slice(0, 137).trimEnd() + '…' : d;
			return { lines: [{ text: trimmed, emphasis: 'value' }] };
		}
	},
	{
		id: 'emission',
		keyboardIndex: 3,
		angle: Math.PI / 2, // 3:00
		sigilLabel: 'emission',
		lengthFor(subnet) {
			const share = subnet.emissionShare ?? 0;
			return EMISSION_FILAMENT_BASE + EMISSION_FILAMENT_SCALE * Math.max(0, Math.min(1, share));
		},
		render(subnet) {
			const share = subnet.emissionShare;
			return {
				lines: [
					{ text: `emission · ${fmtPct(share, 2)}`, emphasis: 'value' },
					{ text: fmtTaoPerDay(share), emphasis: 'detail' }
				]
			};
		}
	},
	{
		id: 'signal',
		keyboardIndex: 4,
		angle: (3 * Math.PI) / 4, // 4:30
		sigilLabel: 'signal',
		lengthFor: () => CONSTANT_FILAMENT_LENGTH,
		render(subnet) {
			return {
				lines: [
					{ text: signalNarrative(subnet), emphasis: 'value' },
					{ text: `source · ${subnet.signalSource ?? 'unset'}`, emphasis: 'detail' }
				]
			};
		}
	},
	{
		id: 'age',
		keyboardIndex: 5,
		angle: Math.PI, // 6:00
		sigilLabel: 'age',
		lengthFor(subnet) {
			const days = subnet.daysSinceRegistration ?? null;
			if (days === null || days < 0) return AGE_FILAMENT_BASE;
			return AGE_FILAMENT_BASE + AGE_FILAMENT_SCALE * Math.log(1 + days / 30);
		},
		render(subnet) {
			const days = subnet.daysSinceRegistration ?? null;
			return {
				lines: [
					{ text: `registered · ${fmtDays(days)}`, emphasis: 'value' },
					{ text: `cohort · ${ageCohort(days)}`, emphasis: 'detail' }
				]
			};
		}
	},
	{
		id: 'trend',
		keyboardIndex: 6,
		angle: (5 * Math.PI) / 4, // 7:30
		sigilLabel: 'trend',
		lengthFor(subnet) {
			const d = subnet.emissionShareDelta24h ?? 0;
			return TREND_FILAMENT_BASE + TREND_FILAMENT_SCALE * Math.abs(d);
		},
		render(subnet) {
			const d24 = subnet.emissionShareDelta24h ?? null;
			const arrow24 = fmtArrow(d24);
			const d7 = subnet.emissionShareDelta7epoch ?? null;
			const arrow7 = fmtArrow(d7);
			const emissionLine =
				d24 !== null && Number.isFinite(d24)
					? `${arrow24} 24h emission ${fmtPct(Math.abs(d24), 3)}`
					: '24h trend · no signal yet';
			const sevenLine =
				d7 !== null && Number.isFinite(d7)
					? `${arrow7} 7-epoch ${fmtPct(Math.abs(d7), 3)}`
					: '7-epoch trend · no signal yet';
			return {
				lines: [
					{ text: emissionLine, emphasis: 'value' },
					{ text: sevenLine, emphasis: 'detail' },
					{ text: fmtRankDelta(subnet.rankDelta24h), emphasis: 'detail' }
				]
			};
		}
	},
	{
		id: 'network',
		keyboardIndex: 7,
		angle: (3 * Math.PI) / 2, // 9:00
		sigilLabel: 'network',
		lengthFor: () => CONSTANT_FILAMENT_LENGTH,
		render(subnet) {
			const v = subnet.validators;
			const m = subnet.miners;
			const vStr = v !== null && v !== undefined ? `${v}/64 validators` : '— validators';
			const mStr = m !== null && m !== undefined ? `${m} miners` : '— miners';
			return {
				lines: [
					{ text: vStr, emphasis: 'value' },
					{ text: mStr, emphasis: 'detail' }
				]
			};
		}
	},
	{
		id: 'links',
		keyboardIndex: 8,
		angle: (7 * Math.PI) / 4, // 10:30
		sigilLabel: 'links',
		lengthFor: () => CONSTANT_FILAMENT_LENGTH,
		render(subnet) {
			const entries: TerminalLine[] = [];
			if (subnet.website) entries.push({ text: 'website', emphasis: 'value', href: subnet.website });
			if (subnet.github) entries.push({ text: 'github', emphasis: 'value', href: subnet.github });
			if (subnet.twitter) entries.push({ text: 'twitter', emphasis: 'value', href: subnet.twitter });
			if (subnet.discord) entries.push({ text: 'discord', emphasis: 'value', href: subnet.discord });
			if (!entries.length) entries.push({ text: 'links — owner has not registered', emphasis: 'detail' });
			return { lines: entries };
		}
	}
];

/** Lookup by id (handy in the orchestrator). */
export const SEGMENT_BY_ID: ReadonlyMap<SegmentId, SegmentDef> = new Map(
	SEGMENTS.map((s) => [s.id, s])
);
