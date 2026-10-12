/** Normalize vault-relative path separators and dot segments, preserving case and whitespace. */
export function normalizeVaultPath(path: string): string | null {
	if (
		/^[\\/]|^[a-z]:/i.test(path) ||
		[...path].some((character) => character.charCodeAt(0) < 32)
	)
		return null;
	const parts = path.replace(/\\/g, '/').split('/');
	if (parts.includes('..')) return null;
	return parts.filter((part) => part !== '' && part !== '.').join('/');
}

/** Match path to subtree at segment boundaries; neither argument represents the vault root. */
export function isInSubtree(path: string, subtree: string): boolean {
	return path === subtree || path.startsWith(`${subtree}/`);
}

/** Require path to identify a non-root folder before mutating its assignments. */
export function requireFolderPath(path: string): string {
	const normalized = normalizeVaultPath(path);
	if (!normalized)
		throw new Error('A non-root vault folder path is required.');
	return normalized;
}

/** Rewrite explicit assignments under oldPath to newPath; destination collisions reject the move. */
export function rewriteAssignments(
	assignments: Readonly<Record<string, string>>,
	oldPath: string,
	newPath: string,
): Readonly<Record<string, string>> {
	const from = requireFolderPath(oldPath);
	const to = requireFolderPath(newPath);
	if (from === to) return assignments;
	const entries = Object.entries(assignments);
	if (!entries.some(([path]) => isInSubtree(path, from))) return assignments;
	const rewritten = new Map<string, string>();
	for (const [path, id] of entries) {
		const nextPath = isInSubtree(path, from)
			? to + path.slice(from.length)
			: path;
		if (rewritten.has(nextPath))
			throw new Error(
				'Moving folder color assignments would replace an existing assignment.',
			);
		rewritten.set(nextPath, id);
	}
	return Object.fromEntries(rewritten);
}

/** Remove only explicit assignments inside the deleted folderPath subtree. */
export function removeSubtreeAssignments(
	assignments: Readonly<Record<string, string>>,
	folderPath: string,
): Readonly<Record<string, string>> {
	const subtree = requireFolderPath(folderPath);
	const entries = Object.entries(assignments);
	const remaining = entries.filter(([path]) => !isInSubtree(path, subtree));
	return entries.length === remaining.length
		? assignments
		: Object.fromEntries(remaining);
}
