import { contrastRatio, meetsContrast } from './contrast';
import { fromOklch, toOklch } from './oklch';
import { parseColor, toHex, type Rgba } from './rgba';

/** Find color's closest same-hue lightness meeting threshold on surface after rounding at opacity (default 1).
 * Chroma decreases only as needed for sRGB gamut; seed data is never changed.
 */
export function adaptColor(
	color: Rgba,
	surface: Rgba,
	threshold: number,
	opacity = 1,
): `#${string}` | null {
	const base = toOklch(color);
	if (!base) return null;
	const initial = toHex(color);
	if (
		initial &&
		meetsContrast(
			contrastRatio({ ...parseColor(initial)!, a: opacity }, surface),
			threshold,
		)
	)
		return initial;
	const candidates: { hex: `#${string}`; distance: number }[] = [];
	for (const end of [0, 1]) {
		let failing = base.l;
		let passing = end;
		let hex = toHex(fromOklch({ ...base, l: end })!);
		if (
			!hex ||
			!meetsContrast(
				contrastRatio({ ...parseColor(hex)!, a: opacity }, surface),
				threshold,
			)
		)
			continue;
		for (let step = 0; step < 20; step++) {
			const middle = (failing + passing) / 2;
			const candidate = fromOklch({ ...base, l: middle });
			const value = candidate && toHex(candidate);
			if (
				value &&
				meetsContrast(
					contrastRatio(
						{ ...parseColor(value)!, a: opacity },
						surface,
					),
					threshold,
				)
			) {
				passing = middle;
				hex = value;
			} else failing = middle;
		}
		candidates.push({ hex, distance: Math.abs(passing - base.l) });
	}
	candidates.sort((a, b) => a.distance - b.distance);
	return candidates[0]?.hex ?? null;
}
