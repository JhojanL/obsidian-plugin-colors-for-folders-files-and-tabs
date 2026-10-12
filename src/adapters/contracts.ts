import type { ColorIdentity, ColorTarget } from '../model/types';
export type { ColorTarget } from '../model/types';

/** Resolve a target's path and kind to its family/depth/role identity, or null for neutral. */
export type ColorResolver = (target: ColorTarget) => ColorIdentity | null;

export interface TabTarget {
	element: HTMLElement;
	/** Current file identity; null represents a non-file or unsupported view. */
	filePath: string | null;
}

export interface HostSnapshot {
	explorerRoots: readonly HTMLElement[];
	tabs: readonly TabTarget[];
}

/** Validate a DOM-supplied path without trimming meaningful filename whitespace. */
export function isVaultPath(path: string): boolean {
	return (
		!path.includes('\\') &&
		path
			.split('/')
			.every((part) => part !== '' && part !== '.' && part !== '..')
	);
}

/** Read constructors from a document's realm, including Obsidian pop-out windows. */
export function getDomWindow(doc: Document): Document['defaultView'] {
	return doc.defaultView;
}

/** Recognize unknown host elements even after adoption into another window's document. */
export function isHTMLElement(value: unknown): value is HTMLElement {
	if (!value || typeof value !== 'object' || !('ownerDocument' in value)) {
		return false;
	}
	if ('instanceOf' in value && typeof value.instanceOf === 'function') {
		// Obsidian checks constructorWin as well as the node's current owner window.
		return (value as Pick<Node, 'instanceOf'>).instanceOf(HTMLElement);
	}
	const doc = value.ownerDocument;
	if (!doc || typeof doc !== 'object' || !('defaultView' in doc))
		return false;
	const win = doc.defaultView;
	if (!win || typeof win !== 'object' || !('HTMLElement' in win))
		return false;
	return (
		typeof win.HTMLElement === 'function' &&
		(value instanceof HTMLElement || value instanceof win.HTMLElement)
	);
}
