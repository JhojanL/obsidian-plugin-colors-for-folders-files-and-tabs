import { encodedChannel, linearChannel, validRgba, type Rgba } from './rgba';

export interface Oklch {
	readonly l: number;
	readonly c: number;
	/** Hue in radians; achromatic colors use zero. */
	readonly h: number;
}

/** Convert opaque sRGB color to OKLCH for perceptual variations, independently of WCAG luminance. */
export function toOklch(color: Rgba): Oklch | null {
	if (!validRgba(color) || color.a !== 1) return null;
	const r = linearChannel(color.r);
	const g = linearChannel(color.g);
	const b = linearChannel(color.b);
	// OKLab's D65 linear-sRGB matrices: https://bottosson.github.io/posts/oklab/
	const x = Math.cbrt(0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b);
	const y = Math.cbrt(0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b);
	const z = Math.cbrt(0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b);
	const a = 1.9779984951 * x - 2.428592205 * y + 0.4505937099 * z;
	const labB = 0.0259040371 * x + 0.7827717662 * y - 0.808675766 * z;
	return {
		l: 0.2104542553 * x + 0.793617785 * y - 0.0040720468 * z,
		c: Math.hypot(a, labB),
		h: Math.hypot(a, labB) < 0.000001 ? 0 : Math.atan2(labB, a),
	};
}

/** Convert l/c/h into encoded sRGB without clipping, so gamut reduction can preserve hue. */
function toRgb(l: number, c: number, h: number): Rgba {
	const a = c * Math.cos(h);
	const b = c * Math.sin(h);
	const x = (l + 0.3963377774 * a + 0.2158037573 * b) ** 3;
	const y = (l - 0.1055613458 * a - 0.0638541728 * b) ** 3;
	const z = (l - 0.0894841775 * a - 1.291485548 * b) ** 3;
	return {
		r: encodedChannel(
			4.0767416621 * x - 3.3077115913 * y + 0.2309699292 * z,
		),
		g: encodedChannel(
			-1.2684380046 * x + 2.6097574011 * y - 0.3413193965 * z,
		),
		b: encodedChannel(
			-0.0041960863 * x - 0.7034186147 * y + 1.707614701 * z,
		),
		a: 1,
	};
}

/** Map color to sRGB by reducing chroma at fixed lightness/hue; reject non-finite or invalid ranges. */
export function fromOklch(color: Oklch): Rgba | null {
	const { l, c, h } = color;
	if (![l, c, h].every(Number.isFinite) || l < 0 || l > 1 || c < 0)
		return null;
	if (l === 0 || l === 1) return { r: l, g: l, b: l, a: 1 };
	const original = toRgb(l, c, h);
	if (validRgba(original)) return original;
	let low = 0;
	let high = c;
	let result = toRgb(l, 0, h);
	for (let step = 0; step < 20; step++) {
		const middle = (low + high) / 2;
		const candidate = toRgb(l, middle, h);
		if (validRgba(candidate)) {
			low = middle;
			result = candidate;
		} else high = middle;
	}
	return validRgba(result) ? result : null;
}
