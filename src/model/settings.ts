import { normalizeVaultPath } from './paths';
import {
	SETTINGS_VERSION,
	THEME_COLOR_TOKENS,
	type ColorSeed,
	type ColorSettings,
	type ColoringOptions,
	type PaletteColor,
} from './types';

export type SettingsStatus =
	'empty' | 'valid' | 'migrated' | 'invalid' | 'future' | 'load-error';

export interface SettingsRead {
	readonly settings: ColorSettings;
	readonly status: SettingsStatus;
	readonly writable: boolean;
}

export const DEFAULT_COLORING: ColoringOptions = Object.freeze({
	text: false,
	icons: true,
	tabs: true,
});

/** Create fresh defaults with stable palette IDs and no automatic folder assignments. */
export function defaultSettings(): ColorSettings {
	return freezeSettings({
		schemaVersion: SETTINGS_VERSION,
		palette: THEME_COLOR_TOKENS.map((seed) => {
			const id = seed.slice('--color-'.length);
			return { id, name: id.charAt(0).toUpperCase() + id.slice(1), seed };
		}),
		assignments: {},
		coloring: DEFAULT_COLORING,
	});
}

/** Validate value as an allowlisted theme token or opaque six-digit hex seed. */
export function readColorSeed(value: unknown): ColorSeed | null {
	if (typeof value !== 'string') return null;
	if (/^#[\da-f]{6}$/i.test(value)) return value.toLowerCase() as ColorSeed;
	return THEME_COLOR_TOKENS.find((token) => token === value) ?? null;
}

/** Check value for a plain persisted record; arrays and special prototypes are unsupported. */
function isRecord(value: unknown): value is Record<string, unknown> {
	return (
		value !== null &&
		typeof value === 'object' &&
		!Array.isArray(value) &&
		(Object.getPrototypeOf(value) === Object.prototype ||
			Object.getPrototypeOf(value) === null)
	);
}

/** Require record's own keys to fit keys, so validation never silently drops unknown data. */
function hasOnlyKeys(
	record: Record<string, unknown>,
	keys: readonly string[],
): boolean {
	return Object.keys(record).every((key) => keys.includes(key));
}

/** Decode value as a palette entry, retaining its ID while normalizing its display name and hex. */
function readPaletteColor(value: unknown): PaletteColor | null {
	if (!isRecord(value) || !hasOnlyKeys(value, ['id', 'name', 'seed']))
		return null;
	const { id, name } = value;
	const seed = readColorSeed(value.seed);
	if (
		typeof id !== 'string' ||
		!/^[a-z\d][a-z\d_-]*$/i.test(id) ||
		typeof name !== 'string' ||
		name.trim() === '' ||
		!seed
	)
		return null;
	return { id, name: name.trim(), seed };
}

/** Freeze settings and its nested records so readers cannot mutate cached identities or save snapshots. */
function freezeSettings(settings: ColorSettings): ColorSettings {
	return Object.freeze({
		...settings,
		palette: Object.freeze(
			settings.palette.map((color) => Object.freeze({ ...color })),
		),
		assignments: Object.freeze({ ...settings.assignments }),
		coloring: Object.freeze({ ...settings.coloring }),
	});
}

/** Validate unknown stored data; version 0 or an absent version migrates the same explicit model to v1.
 * Invalid and future data use neutral defaults and prohibit writes; this function never persists data.
 */
export function readSettings(data: unknown): SettingsRead {
	if (data === null || data === undefined)
		return { settings: defaultSettings(), status: 'empty', writable: true };
	const blocked = (status: 'invalid' | 'future'): SettingsRead => ({
		settings: defaultSettings(),
		status,
		writable: false,
	});
	if (!isRecord(data)) return blocked('invalid');
	if (
		typeof data.schemaVersion === 'number' &&
		data.schemaVersion > SETTINGS_VERSION
	)
		return blocked('future');
	if (
		!hasOnlyKeys(data, [
			'schemaVersion',
			'palette',
			'assignments',
			'coloring',
		]) ||
		(data.schemaVersion !== undefined &&
			data.schemaVersion !== 0 &&
			data.schemaVersion !== SETTINGS_VERSION) ||
		!Array.isArray(data.palette) ||
		!isRecord(data.assignments)
	)
		return blocked('invalid');
	const coloring: ColoringOptions = { ...DEFAULT_COLORING };
	if (data.coloring !== undefined) {
		const value = data.coloring;
		if (
			!isRecord(value) ||
			!hasOnlyKeys(value, ['text', 'icons', 'tabs']) ||
			!['text', 'icons', 'tabs'].every(
				(key) => typeof value[key] === 'boolean',
			)
		)
			return blocked('invalid');
		Object.assign(coloring, value);
	}
	const palette: PaletteColor[] = [];
	const ids = new Set<string>();
	for (const value of data.palette) {
		const color = readPaletteColor(value);
		if (!color || ids.has(color.id)) return blocked('invalid');
		ids.add(color.id);
		palette.push(color);
	}
	const assignments = new Map<string, string>();
	for (const [path, id] of Object.entries(data.assignments)) {
		const normalized = normalizeVaultPath(path);
		if (
			!normalized ||
			typeof id !== 'string' ||
			!ids.has(id) ||
			assignments.has(normalized)
		)
			return blocked('invalid');
		assignments.set(normalized, id);
	}
	return {
		settings: freezeSettings({
			schemaVersion: SETTINGS_VERSION,
			palette,
			assignments: Object.fromEntries(assignments),
			coloring,
		}),
		status: data.schemaVersion === SETTINGS_VERSION ? 'valid' : 'migrated',
		writable: true,
	};
}
