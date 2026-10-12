export const SETTINGS_VERSION = 1;

export const THEME_COLOR_TOKENS = [
	'--color-red',
	'--color-orange',
	'--color-yellow',
	'--color-green',
	'--color-cyan',
	'--color-blue',
	'--color-purple',
	'--color-pink',
] as const;

export type ColorSeed = (typeof THEME_COLOR_TOKENS)[number] | `#${string}`;

export interface PaletteColor {
	readonly id: string;
	readonly name: string;
	readonly seed: ColorSeed;
}

export interface ColorSettings {
	readonly schemaVersion: typeof SETTINGS_VERSION;
	readonly palette: readonly PaletteColor[];
	/** Only explicitly assigned, non-root folder paths are stored. */
	readonly assignments: Readonly<Record<string, string>>;
	readonly coloring: ColoringOptions;
}

export interface ColoringOptions {
	/** Optional Explorer name colors; tab names always follow the host theme. */
	readonly text: boolean;
	/** Explorer folder/file icon colors. */
	readonly icons: boolean;
	/** File-backed tab icon colors, independent of the Explorer preference. */
	readonly tabs: boolean;
}

export interface ColorTarget {
	/** Case-sensitive, vault-relative path; a file includes its filename. */
	readonly path: string;
	readonly kind: 'folder' | 'file';
}

export interface ColorIdentity {
	readonly color: PaletteColor;
	readonly assignedPath: string;
	/** Folder steps from the assigned ancestor to the target's containing folder. */
	readonly relativeDepth: number;
	readonly role: ColorTarget['kind'];
}
