import {
	paletteColorErrors,
	type SeedHexResolver,
} from '../model/palette-validation';
import { readColorSeed } from '../model/settings';
import type { ColorSeed, PaletteColor } from '../model/types';

interface ColorDraftOptions {
	readonly palette?: readonly PaletteColor[];
	readonly resolveSeedHex?: SeedHexResolver;
	/** Name-only edits retain the original theme token, including when it cannot be resolved. */
	readonly retainedSeed?: ColorSeed;
}

export interface ColorDraftResult {
	readonly color: PaletteColor | null;
	readonly nameError: string;
	readonly hexError: string;
}

/** Validate name and hex from either input, retaining id; options supplies palette/theme comparisons and an unchanged original seed. */
export function readColorDraft(
	id: string,
	name: string,
	hex: string,
	options: ColorDraftOptions = {},
): ColorDraftResult {
	const seed = readColorSeed(hex.trim());
	const color: PaletteColor = {
		id,
		name: name.trim(),
		seed: options.retainedSeed ?? seed ?? '#',
	};
	const conflicts = paletteColorErrors(
		color,
		options.palette ?? [],
		options.resolveSeedHex,
	);
	const nameError = color.name ? conflicts.nameError : 'Enter a color name.';
	const hexError = seed?.startsWith('#')
		? conflicts.hexError
		: 'Enter six hex digits, such as #8b6cef.';
	return {
		color: !nameError && !hexError && seed ? color : null,
		nameError,
		hexError,
	};
}
