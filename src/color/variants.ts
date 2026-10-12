import { fromOklch, toOklch } from './oklch';
import type { Rgba } from './rgba';

export type AppearanceMode = 'light' | 'dark';
export type RenderRole = 'folder' | 'file' | 'tab' | 'preview';

/** Clamp depth to four folder bands; malformed/negative depths use the assigned-folder band. */
export function depthBand(depth: number): number {
	return Number.isFinite(depth)
		? Math.min(3, Math.max(0, Math.floor(depth)))
		: 0;
}

/** Vary seed by relative depth/role in mode; tabs and previews use the containing-folder tone. */
export function varyColor(
	seed: Rgba,
	depth: number,
	role: RenderRole,
	mode: AppearanceMode,
): Rgba | null {
	const base = toOklch(seed);
	if (!base) return null;
	const band = depthBand(depth);
	const fileOffset = role === 'file' ? 0.008 : 0;
	return fromOklch({
		...base,
		l: Math.max(
			0,
			Math.min(
				1,
				base.l +
					(mode === 'dark' ? 1 : -1) * (band * 0.018 + fileOffset),
			),
		),
		c: base.c * (1 - band * 0.05 - (role === 'file' ? 0.025 : 0)),
	});
}
