import { paletteColorErrors, type SeedHexResolver } from './palette-validation';
import {
	requireFolderPath,
	rewriteAssignments,
	removeSubtreeAssignments,
} from './paths';
import type { ColorSettings, PaletteColor } from './types';

/**
 * Assign paletteId from settings to non-root folderPath, or clear with null to resume inheritance.
 * settings is not mutated; unchanged assignments return it by identity. Invalid paths or unknown IDs throw.
 */
export function assignFolder(
	settings: ColorSettings,
	folderPath: string,
	paletteId: string | null,
): ColorSettings {
	const path = requireFolderPath(folderPath);
	if (
		paletteId !== null &&
		!settings.palette.some((color) => color.id === paletteId)
	)
		throw new Error('The selected palette color does not exist.');
	if (paletteId === null) {
		if (!Object.prototype.hasOwnProperty.call(settings.assignments, path))
			return settings;
		const assignments = { ...settings.assignments };
		delete assignments[path];
		return { ...settings, assignments };
	}
	if (settings.assignments[path] === paletteId) return settings;
	return {
		...settings,
		assignments: { ...settings.assignments, [path]: paletteId },
	};
}

/** Insert or edit color in settings by stable ID after checking duplicates; resolveSeedHex optionally resolves live theme values. */
export function putPaletteColor(
	settings: ColorSettings,
	color: PaletteColor,
	resolveSeedHex?: SeedHexResolver,
): ColorSettings {
	const errors = paletteColorErrors(color, settings.palette, resolveSeedHex);
	if (errors.nameError || errors.hexError)
		throw new Error(errors.nameError || errors.hexError);
	const found = settings.palette.some((entry) => entry.id === color.id);
	return {
		...settings,
		palette: found
			? settings.palette.map((entry) =>
					entry.id === color.id ? color : entry,
				)
			: [...settings.palette, color],
	};
}

/** Remove paletteId and all its explicit references, letting affected folders inherit or become neutral. */
export function removePaletteColor(
	settings: ColorSettings,
	paletteId: string,
): ColorSettings {
	if (!settings.palette.some((color) => color.id === paletteId))
		return settings;
	return {
		...settings,
		palette: settings.palette.filter((color) => color.id !== paletteId),
		assignments: Object.fromEntries(
			Object.entries(settings.assignments).filter(
				([, id]) => id !== paletteId,
			),
		),
	};
}

/** Rewrite assignment keys when a folder moves from oldPath to newPath; settings are never mutated. */
export function moveFolder(
	settings: ColorSettings,
	oldPath: string,
	newPath: string,
): ColorSettings {
	const assignments = rewriteAssignments(
		settings.assignments,
		oldPath,
		newPath,
	);
	return assignments === settings.assignments
		? settings
		: { ...settings, assignments };
}

/** Remove assignment keys only inside the deleted folderPath subtree. */
export function deleteFolder(
	settings: ColorSettings,
	folderPath: string,
): ColorSettings {
	const assignments = removeSubtreeAssignments(
		settings.assignments,
		folderPath,
	);
	return assignments === settings.assignments
		? settings
		: { ...settings, assignments };
}
