import { afterEach, describe, expect, it, vi } from 'vitest';
import { ColorEngine, type RenderContext } from '../../src/color/engine';
import { adaptColor } from '../../src/color/adapt';
import * as adaptation from '../../src/color/adapt';
import { fromOklch, toOklch } from '../../src/color/oklch';
import { parseColor, toHex, type Rgba } from '../../src/color/rgba';
import {
	depthBand,
	varyColor,
	type AppearanceMode,
} from '../../src/color/variants';
import type { ColorIdentity } from '../../src/model/types';

/** Decode a known opaque fixture independently of host CSS. */
function color(value: string): Rgba {
	const parsed = parseColor(value);
	if (!parsed) throw new Error(`Invalid fixture ${value}`);
	return parsed;
}

/** Independent WCAG oracle for final rendered hex values; does not import implementation luminance/compositing. */
function expectedContrast(foreground: string, background: string): number {
	const luminance = (hex: string): number => {
		const channels = [1, 3, 5].map(
			(offset) => parseInt(hex.slice(offset, offset + 2), 16) / 255,
		);
		const [r = 0, g = 0, b = 0] = channels.map((value) =>
			value > 0.04045
				? Math.pow((value + 0.055) / 1.055, 2.4)
				: value / 12.92,
		);
		return r * 0.2126 + g * 0.7152 + b * 0.0722;
	};
	const a = luminance(foreground);
	const b = luminance(background);
	return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
}

/** Independently composite an opaque hex foreground at opacity over background before the oracle. */
function expectedAlphaContrast(
	foreground: string,
	background: string,
	opacity: number,
): number {
	const linear = (channel: number): number =>
		channel <= 0.04045
			? channel / 12.92
			: Math.pow((channel + 0.055) / 1.055, 2.4);
	const front = [1, 3, 5].map(
		(offset) => parseInt(foreground.slice(offset, offset + 2), 16) / 255,
	);
	const back = [1, 3, 5].map(
		(offset) => parseInt(background.slice(offset, offset + 2), 16) / 255,
	);
	const rendered = front.map(
		(value, index) => value * opacity + (back[index] ?? 0) * (1 - opacity),
	);
	const lum = (channels: number[]): number =>
		channels.reduce(
			(sum, value, index) =>
				sum + linear(value) * ([0.2126, 0.7152, 0.0722][index] ?? 0),
			0,
		);
	return (
		(Math.max(lum(rendered), lum(back)) + 0.05) /
		(Math.min(lum(rendered), lum(back)) + 0.05)
	);
}

const identity: ColorIdentity = {
	color: { id: 'custom', name: 'My violet', seed: '#8b6cef' },
	assignedPath: 'A',
	relativeDepth: 0,
	role: 'folder',
};
const context: RenderContext = {
	mode: 'dark',
	revision: 0,
	seed: color('#8b6cef'),
	surface: color('#282828'),
	state: 'normal',
};

afterEach(() => vi.restoreAllMocks());

describe('bounded perceptual family variants', () => {
	it('matches independently published OKLab red coordinates and round-trips known colors', () => {
		const red = toOklch(color('#ff0000'));
		expect(red?.l).toBeCloseTo(0.6279553606, 8);
		expect(red?.c).toBeCloseTo(0.2576833077, 8);
		expect(red?.h).toBeCloseTo(0.5102275498, 8);
		for (const hex of [
			'#000000',
			'#ffffff',
			'#ff0000',
			'#00ff00',
			'#0000ff',
			'#8b6cef',
		]) {
			const perceptual = toOklch(color(hex));
			if (!perceptual) throw new Error('Missing color conversion');
			const rgb = fromOklch(perceptual);
			expect(rgb && toHex(rgb)).toBe(hex);
		}
	});

	it.each(['light', 'dark'] as const)(
		'keeps four same-hue bands and clamps deeper folders in %s mode',
		(mode) => {
			const seed = color('#8b6cef');
			const bands = [0, 1, 2, 3].map((depth) =>
				varyColor(seed, depth, 'folder', mode),
			);
			expect(new Set(bands.map((rgb) => rgb && toHex(rgb))).size).toBe(4);
			expect(varyColor(seed, 1000, 'folder', mode)).toEqual(bands[3]);
			expect(varyColor(seed, -3, 'folder', mode)).toEqual(bands[0]);
			const base = toOklch(seed);
			if (!base) throw new Error('Missing fixture conversion');
			for (const rgb of bands) {
				if (!rgb) throw new Error('Missing variant');
				const variant = toOklch(rgb);
				expect(variant?.h).toBeCloseTo(base.h, 5);
				expect(Math.abs((variant?.l ?? 0) - base.l)).toBeLessThan(
					0.055,
				);
				expect(rgb.a).toBe(1);
			}
			expect(varyColor(seed, 2, 'tab', mode)).toEqual(bands[2]);
			expect(varyColor(seed, 2, 'preview', mode)).toEqual(bands[2]);
			expect(varyColor(seed, 2, 'file', mode)).not.toEqual(bands[2]);
		},
	);

	it('fails safely for non-finite/out-of-range color inputs', () => {
		expect(depthBand(NaN)).toBe(0);
		expect(depthBand(Infinity)).toBe(0);
		expect(fromOklch({ l: NaN, c: 1, h: 0 })).toBeNull();
		expect(fromOklch({ l: -1, c: 1, h: 0 })).toBeNull();
		expect(fromOklch({ l: 0.5, c: -1, h: 0 })).toBeNull();
		expect(varyColor(color('transparent'), 0, 'file', 'dark')).toBeNull();
		expect(adaptColor(color('#fff'), color('transparent'), 4.5)).toBeNull();
	});
});

describe('shared contrast-aware rendering', () => {
	it.each(['text', 'icon'] as const)(
		'adapts only the requested %s foreground and keeps its cache separate',
		(channel) => {
			const engine = new ColorEngine();
			const full = engine.render(identity, 'folder', context)!;
			const adapt = vi.spyOn(adaptation, 'adaptColor');
			const selected = engine.render(
				identity,
				'folder',
				context,
				channel,
			)!;
			expect(selected[channel]).toBe(full[channel]);
			expect(selected[channel === 'text' ? 'icon' : 'text']).toBeNull();
			expect(selected.status).toBe('evaluated');
			expect(adapt.mock.calls.map((call) => call[2])).toEqual([
				channel === 'text' ? 4.6 : 3.1,
			]);
			adapt.mockClear();
			expect(engine.render(identity, 'folder', context, channel)).toBe(
				selected,
			);
			expect(adapt).not.toHaveBeenCalled();
			expect(engine.render(identity, 'folder', context)).toBe(full);
		},
	);

	it('accounts for existing glyph opacity and falls back when alpha makes a threshold unattainable', () => {
		const engine = new ColorEngine();
		for (const surface of ['#ffffff', '#282828', '#918173']) {
			const rendered = engine.render(identity, 'folder', {
				...context,
				surface: color(surface),
				foregroundOpacity: 0.85,
			});
			if (!rendered?.icon) throw new Error('Missing adapted icon');
			expect(
				expectedAlphaContrast(rendered.icon, surface, 0.85),
			).toBeGreaterThanOrEqual(3);
			expect(rendered.indicatorContrast).toBeCloseTo(
				expectedAlphaContrast(rendered.icon, surface, 0.85),
				12,
			);
		}
		expect(
			engine.render(identity, 'folder', {
				...context,
				surface: color('#918173'),
				foregroundOpacity: 0.1,
			})?.icon,
		).toBeNull();
		expect(
			engine.render(identity, 'folder', {
				...context,
				foregroundOpacity: NaN,
			})?.status,
		).toBe('accent-only');
	});
	it.each(['#ffffff', '#282828', '#918173'])(
		'meets text and indicator thresholds on %s after hex rounding for all named families',
		(surface) => {
			const engine = new ColorEngine();
			for (const hex of [
				'#e93147',
				'#ec7500',
				'#e0ac00',
				'#08b94e',
				'#00bfbc',
				'#086ddd',
				'#7852ee',
				'#d53984',
				'#ffffff',
				'#000000',
			]) {
				for (const mode of ['light', 'dark'] as const) {
					for (const depth of [0, 1, 2, 3, 1000]) {
						const input = {
							...identity,
							color: {
								...identity.color,
								seed: hex as `#${string}`,
							},
							relativeDepth: depth,
						};
						const rendered = engine.render(input, 'folder', {
							...context,
							mode,
							seed: color(hex),
							surface: color(surface),
						});
						if (!rendered?.text || !rendered.icon)
							throw new Error('Missing evaluated colors');
						expect(
							expectedContrast(rendered.text, surface),
						).toBeGreaterThanOrEqual(4.5);
						expect(
							expectedContrast(rendered.icon, surface),
						).toBeGreaterThanOrEqual(3);
					}
				}
			}
		},
	);

	it('shares containing-folder variants with tabs/previews and retains the custom seed/name', () => {
		const engine = new ColorEngine();
		const snapshot = JSON.stringify(identity);
		const folder = engine.render(identity, 'folder', context);
		expect(engine.render(identity, 'tab', context)).toEqual(folder);
		expect(engine.render(identity, 'preview', context)).toEqual(folder);
		expect(engine.render(identity, 'file', context)?.accent).not.toBe(
			folder?.accent,
		);
		expect(JSON.stringify(identity)).toBe(snapshot);
	});

	it('separates cached results by theme revision, seed, depth/role, actual surface, and state', () => {
		const engine = new ColorEngine();
		const first = engine.render(identity, 'folder', context);
		expect(engine.render(identity, 'folder', context)).toBe(first);
		for (const changed of [
			{ ...context, revision: 1 },
			{ ...context, foregroundOpacity: 0.85 },
			{ ...context, seed: color('#00bfbc') },
			{ ...context, surface: color('#ffffff') },
			{ ...context, state: 'hover' as const },
			{ ...context, mode: 'light' as AppearanceMode },
		]) {
			const rendered = engine.render(identity, 'folder', changed);
			expect(rendered).not.toBe(first);
			expect(rendered).toEqual(
				new ColorEngine().render(identity, 'folder', changed),
			);
		}
		expect(
			engine.render({ ...identity, relativeDepth: 1 }, 'folder', context),
		).not.toBe(first);
		expect(
			engine.render({ ...identity, relativeDepth: 1 }, 'folder', context),
		).toEqual(
			new ColorEngine().render(
				{ ...identity, relativeDepth: 1 },
				'folder',
				context,
			),
		);
		expect(engine.render(identity, 'file', context)).not.toBe(first);
		expect(engine.render(identity, 'file', context)).toEqual(
			new ColorEngine().render(identity, 'file', context),
		);
		engine.invalidate();
		expect(engine.render(identity, 'folder', context)).not.toBe(first);
	});

	it.each([{ surface: null }, { mode: null }, { seed: null }])(
		'preserves host text/icons for an unevaluable context %j',
		(unknown) => {
			const engine = new ColorEngine();
			expect(
				engine.render(identity, 'folder', { ...context, ...unknown }),
			).toEqual({
				accent: '#8b6cef',
				text: null,
				icon: null,
				status: 'accent-only',
				textContrast: null,
				indicatorContrast: null,
			});
		},
	);
});
