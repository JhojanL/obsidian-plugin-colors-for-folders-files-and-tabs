import { normalizeVaultPath } from './paths';
import type { ColorIdentity, ColorSettings, ColorTarget } from './types';

/** Resolve target against explicit settings using its nearest colored folder; root files stay neutral.
 * File depth is the depth of its containing folder, so its tabs receive the same identity.
 */
export function resolveColorIdentity(
	settings: ColorSettings,
	target: ColorTarget,
): ColorIdentity | null {
	const path = normalizeVaultPath(target.path);
	if (!path) return null;
	let folder =
		target.kind === 'folder'
			? path
			: path.slice(0, Math.max(0, path.lastIndexOf('/')));
	let relativeDepth = 0;
	while (folder) {
		const id = Object.prototype.hasOwnProperty.call(
			settings.assignments,
			folder,
		)
			? settings.assignments[folder]
			: undefined;
		const color = settings.palette.find((entry) => entry.id === id);
		if (color)
			return Object.freeze({
				color,
				assignedPath: folder,
				relativeDepth,
				role: target.kind,
			});
		const separator = folder.lastIndexOf('/');
		folder = separator < 0 ? '' : folder.slice(0, separator);
		relativeDepth++;
	}
	return null;
}
