import { vi } from 'vitest';
import type { FrameScheduler } from '../../src/adapters/controller';
import type { TabLeaf } from '../../src/adapters/host';
import { FileView } from './obsidian';
import { setHostStyles } from './dom-support';

export { setHostStyles } from './dom-support';

/** Build rendered Explorer rows in doc; no fixture represents an internal file map. */
export function createExplorer(doc: Document = document) {
	const root = doc.createElement('div');
	root.className = 'nav-files-container';
	doc.body.append(root);
	return {
		root,
		/** Add path and kind with optional hostStyles simulating existing inline host decoration. */
		row(
			path: string,
			kind: 'folder' | 'file' = 'file',
			hostStyles: Record<string, string> = {},
		) {
			const element = doc.createElement('div');
			element.className = `tree-item-self nav-${kind}-title is-clickable`;
			element.setAttribute('data-path', path);
			element.tabIndex = 0;
			setHostStyles(element, hostStyles);
			const icon = doc.createElement('span');
			icon.className = 'host-icon';
			const title = doc.createElement('span');
			title.className = `nav-${kind}-title-content`;
			title.textContent = path.split('/').pop() ?? '';
			element.append(icon, title);
			root.append(element);
			return element;
		},
	};
}

/** Build headers in doc using the containers inspected in the installed app. */
export function createTabs(doc: Document = document) {
	const root = doc.createElement('div');
	root.className = 'workspace-tab-header-container';
	const inner = doc.createElement('div');
	inner.className = 'workspace-tab-header-container-inner';
	root.append(inner);
	doc.body.append(root);
	return {
		root,
		/** Add a header with a deliberately ambiguous display title. */
		header(title: string = 'README') {
			const element = doc.createElement('div');
			element.className = 'workspace-tab-header tappable';
			element.tabIndex = 0;
			const text = doc.createElement('span');
			text.className = 'workspace-tab-header-inner-title';
			text.textContent = title;
			const close = doc.createElement('button');
			close.className = 'workspace-tab-header-inner-close-button';
			close.setAttribute('aria-label', 'Close tab');
			const content = doc.createElement('div');
			content.className = 'workspace-tab-header-inner';
			const icon = doc.createElement('div');
			icon.className = 'workspace-tab-header-inner-icon';
			icon.textContent = 'Native icon';
			content.append(icon, text, close);
			element.append(content);
			inner.append(element);
			return element;
		},
	};
}

/** Pair element with a file view for path; null gives a non-file graph view. */
export function createLeaf(
	element: HTMLElement,
	path: string | null,
): TabLeaf & { tabHeaderEl: unknown } {
	return {
		tabHeaderEl: element,
		view:
			path === null ? { getViewType: () => 'graph' } : new FileView(path),
		isDeferred: false,
		getViewState: () => ({
			type: path === null ? 'graph' : 'markdown',
			state: { file: path },
		}),
		getContainer: () => ({ doc: element.ownerDocument }),
	};
}

/** Advance exactly one animation frame at a time, exposing leaked or redundant scheduling. */
export class ManualFrames implements FrameScheduler {
	private id = 0;
	private readonly callbacks = new Map<number, FrameRequestCallback>();

	/** Retain callback until a frame is advanced or canceled. */
	requestAnimationFrame = vi.fn((callback: FrameRequestCallback): number => {
		this.callbacks.set(++this.id, callback);
		return this.id;
	});

	/** Cancel the pending callback identified by handle. */
	cancelAnimationFrame = vi.fn((handle: number): void => {
		this.callbacks.delete(handle);
	});

	get pending(): number {
		return this.callbacks.size;
	}

	/** Run the currently queued batch; callbacks scheduled inside it wait for the next frame. */
	run(): void {
		const current = [...this.callbacks.values()];
		this.callbacks.clear();
		for (const callback of current) callback(0);
	}
}
