import { describe, expect, it } from 'vitest';
import {
	contrastRatio,
	meetsContrast,
	relativeLuminance,
} from '../../src/color/contrast';
import { composite, parseColor, toHex, type Rgba } from '../../src/color/rgba';

/** Decode an explicit test fixture; malformed fixture colors are test-author errors. */
function color(value: string): Rgba {
	const parsed = parseColor(value);
	if (!parsed) throw new Error(`Invalid fixture ${value}`);
	return parsed;
}

describe('WCAG sRGB contrast', () => {
	it('has independently known black/white and equal-color ratios', () => {
		expect(contrastRatio(color('#000000'), color('#ffffff'))).toBe(21);
		expect(contrastRatio(color('#ffffff'), color('#000000'))).toBe(21);
		expect(contrastRatio(color('#123456'), color('#123456'))).toBe(1);
		expect(relativeLuminance(color('#ff0000'))).toBe(0.2126);
		expect(relativeLuminance(color('#00ff00'))).toBe(0.7152);
		expect(relativeLuminance(color('#0000ff'))).toBe(0.0722);
	});

	it.each([
		['#767676', 4.542224959605253, 4.5, true],
		['#777777', 4.478089453577214, 4.5, false],
		['#949494', 3.0334698257384747, 3, true],
		['#959595', 2.9953461357088114, 3, false],
	] as const)(
		'evaluates %s against white without rounding its threshold',
		(hex, expected, threshold, pass) => {
			const ratio = contrastRatio(color(hex), color('#ffffff'));
			expect(ratio).toBeCloseTo(expected, 12);
			expect(meetsContrast(ratio, threshold)).toBe(pass);
		},
	);

	it('compares exact threshold values and rejects non-finite ratios', () => {
		expect(meetsContrast(4.5, 4.5)).toBe(true);
		expect(meetsContrast(4.499999, 4.5)).toBe(false);
		expect(meetsContrast(3, 3)).toBe(true);
		expect(meetsContrast(2.999999, 3)).toBe(false);
		for (const invalid of [null, NaN, Infinity])
			expect(meetsContrast(invalid, 4.5)).toBe(false);
		expect(meetsContrast(21, NaN)).toBe(false);
		expect(meetsContrast(21, 22)).toBe(false);
	});

	it('composites translucent foreground/surfaces rather than dropping alpha', () => {
		const gray = composite(
			color('rgb(255 255 255 / 50%)'),
			color('#000000'),
		);
		expect(gray).toEqual({ r: 0.5, g: 0.5, b: 0.5, a: 1 });
		expect(
			contrastRatio(color('rgb(255 255 255 / 50%)'), color('#000000')),
		).toBeCloseTo(5.280822809644651, 12);
		expect(contrastRatio(color('transparent'), color('#abcdef'))).toBe(1);
		expect(
			composite(color('rgba(0,0,255,0.5)'), color('rgba(255,0,0,0.5)')),
		).toEqual({ r: 1 / 3, g: 0, b: 2 / 3, a: 0.75 });
		expect(contrastRatio(color('#000'), color('transparent'))).toBeNull();
		expect(relativeLuminance(color('#ffffff80'))).toBeNull();
		expect(toHex(color('transparent'))).toBeNull();
	});

	it.each([
		'',
		'#12',
		'#12345',
		'#gggggg',
		'rgb(256,0,0)',
		'rgba(0,0,0,-1)',
		'rgb(NaN 0 0)',
		'rgb(0, 0 0)',
		'rgb(0/0/0)',
		'rgb(0 0 0 / )',
		'url(x)',
		'var(--unknown)',
	])('fails unknown for invalid color %s', (value) => {
		expect(parseColor(value)).toBeNull();
	});

	it('rejects invalid numeric inputs rather than propagating NaN into a pass', () => {
		for (const value of [NaN, Infinity, -0.01, 1.01]) {
			const invalid = { r: value, g: 0, b: 0, a: 1 };
			expect(contrastRatio(invalid, color('#fff'))).toBeNull();
			expect(composite(invalid, color('#fff'))).toBeNull();
			expect(toHex(invalid)).toBeNull();
		}
	});
});
