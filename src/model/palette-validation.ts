import { readColorSeed } from './settings';
import type { ColorSeed, PaletteColor } from './types';

export type SeedHexResolver = (seed: ColorSeed) => string | null;

export interface PaletteColorErrors {
	readonly nameError: string;
	readonly hexError: string;
}

/** Compare name using Unicode compatibility normalization, lowercase text, and collapsed whitespace; display text is unchanged. */
function nameKey(name: string): string {
	return name.normalize('NFKC').trim().replace(/\s+/gu, ' ').toLowerCase();
}

/** Normalize value to an opaque six-digit hex key; null and unresolved theme tokens have no key. */
function hexKey(value: string | null): string | null {
	const seed = readColorSeed(value?.trim());
	return seed?.startsWith('#') ? seed : null;
}

/** Find color's conflicts across palette, excluding its stable ID; resolveSeedHex supplies live theme values when available. */
export function paletteColorErrors(
	color: PaletteColor,
	palette: readonly PaletteColor[],
	resolveSeedHex: SeedHexResolver = (seed) => seed,
): PaletteColorErrors {
	const others = palette.filter((entry) => entry.id !== color.id);
	const name = nameKey(color.name);
	const sameName = others.find((entry) => nameKey(entry.name) === name);
	const hex = hexKey(resolveSeedHex(color.seed));
	const sameHex = hex
		? others.find((entry) => hexKey(resolveSeedHex(entry.seed)) === hex)
		: undefined;
	return {
		nameError: sameName
			? `A color named "${sameName.name}" already exists.`
			: '',
		hexError: sameHex
			? `This color already exists as "${sameHex.name}".`
			: '',
	};
}
