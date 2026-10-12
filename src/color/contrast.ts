import { composite, linearChannel, validRgba, type Rgba } from './rgba';

/** Calculate WCAG relative luminance of opaque color; unknown/transparent inputs return null. */
export function relativeLuminance(color: Rgba): number | null {
	if (!validRgba(color) || color.a !== 1) return null;
	return (
		0.2126 * linearChannel(color.r) +
		0.7152 * linearChannel(color.g) +
		0.0722 * linearChannel(color.b)
	);
}

/** Evaluate foreground over an already composited opaque surface; no default backdrop is assumed. */
export function contrastRatio(foreground: Rgba, surface: Rgba): number | null {
	const rendered = composite(foreground, surface);
	const front = rendered && relativeLuminance(rendered);
	const back = relativeLuminance(surface);
	if (front === null || back === null) return null;
	return (Math.max(front, back) + 0.05) / (Math.min(front, back) + 0.05);
}

/** Compare ratio to threshold without rounding; invalid values never establish a pass. */
export function meetsContrast(
	ratio: number | null,
	threshold: number,
): boolean {
	return (
		ratio !== null &&
		Number.isFinite(ratio) &&
		Number.isFinite(threshold) &&
		threshold >= 1 &&
		threshold <= 21 &&
		ratio >= threshold
	);
}
