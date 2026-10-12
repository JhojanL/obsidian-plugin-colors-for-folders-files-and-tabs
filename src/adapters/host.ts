import { FileView } from 'obsidian';
import {
	isHTMLElement,
	isVaultPath,
	type HostSnapshot,
	type TabTarget,
} from './contracts';

export interface TabLeaf {
	view: unknown;
	isDeferred: boolean;
	getViewState(): { type: string; state?: unknown };
	getContainer(): { doc: Document };
}

export interface HostWorkspace {
	getLeavesOfType(
		type: string,
	): readonly { view: { containerEl: HTMLElement } }[];
	iterateAllLeaves(callback: (leaf: TabLeaf) => void): void;
}

// Deferred custom views remain neutral until materialized as a public FileView.
const DEFERRED_FILE_TYPES = new Set([
	'markdown',
	'image',
	'pdf',
	'audio',
	'video',
	'canvas',
	'bases',
]);

/**
 * Pair a guarded internal header with public file/view state, never a title or tab position.
 * leaf is the current host leaf; isFile checks existence and file type using vault metadata.
 */
export function readTabTarget(
	leaf: TabLeaf,
	isFile: (path: string) => boolean,
): TabTarget | null {
	try {
		if (!('tabHeaderEl' in leaf)) return null;
		const element = leaf.tabHeaderEl;
		if (
			!isHTMLElement(element) ||
			!element.isConnected ||
			!element.matches('.workspace-tab-header') ||
			element.ownerDocument !== leaf.getContainer().doc ||
			element.ownerDocument.defaultView?.closed
		)
			return null;

		let filePath: string | null = null;
		if (leaf.view instanceof FileView) {
			filePath = leaf.view.file?.path ?? null;
		} else if (leaf.isDeferred) {
			const { type, state } = leaf.getViewState();
			if (
				DEFERRED_FILE_TYPES.has(type) &&
				state &&
				typeof state === 'object' &&
				'file' in state &&
				typeof state.file === 'string'
			)
				filePath = state.file;
		}
		return {
			element,
			filePath:
				filePath && isVaultPath(filePath) && isFile(filePath)
					? filePath
					: null,
		};
	} catch {
		// A leaf can disappear while Obsidian moves it between windows.
		return null;
	}
}

/** Read workspace's connected Explorer containers and tab leaves; isFile must check file existence using metadata only. */
export function readHostSnapshot(
	workspace: HostWorkspace,
	isFile: (path: string) => boolean,
): HostSnapshot {
	const explorerRoots: HTMLElement[] = [];
	for (const leaf of workspace.getLeavesOfType('file-explorer')) {
		const root = leaf.view.containerEl;
		if (
			isHTMLElement(root) &&
			root.isConnected &&
			!root.ownerDocument.defaultView?.closed
		) {
			explorerRoots.push(root);
		}
	}
	const tabs: TabTarget[] = [];
	workspace.iterateAllLeaves((leaf) => {
		const target = readTabTarget(leaf, isFile);
		if (target) tabs.push(target);
	});
	return { explorerRoots, tabs };
}
