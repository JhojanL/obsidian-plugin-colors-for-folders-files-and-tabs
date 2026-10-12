import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { readHostSnapshot, readTabTarget } from '../../src/adapters/host';
import { TabAdapter } from '../../src/adapters/tabs';
import { resolveTestColor } from '../fixtures/colors';
import { createLeaf, createTabs } from '../fixtures/dom';
import { FileView } from '../fixtures/obsidian';
import { installObsidianDom } from '../fixtures/dom-support';

let restoreDom: () => void;
const adapters: TabAdapter[] = [];
beforeEach(() => {
	restoreDom = installObsidianDom();
});
afterEach(() => {
	for (const adapter of adapters.splice(0)) adapter.dispose();
	document.body.replaceChildren();
	restoreDom();
});

/** Track adapter cleanup even when a test fails. */
function track(adapter: TabAdapter): TabAdapter {
	adapters.push(adapter);
	return adapter;
}

describe('file-backed tab identity', () => {
	it('preserves file identity when the host adopts a tab header into a pop-out document', () => {
		const tabs = createTabs();
		const header = tabs.header();
		const leaf = createLeaf(header, 'Projects/Projects.md');
		const workspace = {
			getLeavesOfType: () => [],
			iterateAllLeaves: (callback: (currentLeaf: typeof leaf) => void) =>
				callback(leaf),
		};
		const adapter = track(new TabAdapter(resolveTestColor, () => {}));
		adapter.refresh(readHostSnapshot(workspace, () => true).tabs);
		expect(header.matches('.cfft-explorer-color, .cfft-tab-color')).toBe(
			true,
		);
		const iframe = document.createElement('iframe');
		document.body.append(iframe);
		const popoutDoc = iframe.contentDocument;
		if (!popoutDoc) throw new Error('Missing fixture document');
		popoutDoc.body.append(popoutDoc.adoptNode(tabs.root));
		expect(header.ownerDocument).toBe(popoutDoc);
		const snapshot = readHostSnapshot(workspace, () => true);
		expect(snapshot.tabs).toEqual([
			{ element: header, filePath: 'Projects/Projects.md' },
		]);
		adapter.refresh(snapshot.tabs);
		expect(header.matches('.cfft-explorer-color, .cfft-tab-color')).toBe(
			true,
		);
	});

	it('uses the host cross-window helper for headers created in a pop-out then moved to the main window', () => {
		const iframe = document.createElement('iframe');
		document.body.append(iframe);
		const originDoc = iframe.contentDocument;
		const originWindow = originDoc?.defaultView;
		if (!originDoc || !originWindow)
			throw new Error('Missing fixture window');
		const tabs = createTabs(originDoc);
		const header = tabs.header();
		const leaf = createLeaf(header, 'Projects/Projects.md');
		// jsdom has no Obsidian extensions; emulate only the public instanceOf boundary.
		const instanceOf = vi.fn(
			(type: typeof HTMLElement) =>
				type === HTMLElement &&
				Object.prototype.isPrototypeOf.call(
					originWindow.HTMLElement.prototype,
					header,
				),
		);
		Object.defineProperty(header, 'instanceOf', { value: instanceOf });
		document.body.append(document.adoptNode(tabs.root));
		expect(readTabTarget(leaf, () => true)).toEqual({
			element: header,
			filePath: 'Projects/Projects.md',
		});
		expect(instanceOf).toHaveBeenCalledWith(HTMLElement);
	});

	it('colors every matching split or duplicate tab despite identical titles', () => {
		const tabs = createTabs();
		const alpha = tabs.header();
		const alphaDuplicate = tabs.header();
		const beta = tabs.header();
		const home = tabs.header();
		const graph = tabs.header();
		const leaves = [
			createLeaf(alpha, 'Projects/Project-Alpha/README.md'),
			createLeaf(alphaDuplicate, 'Projects/Project-Alpha/README.md'),
			createLeaf(beta, 'Projects/Project-Beta/README.md'),
			createLeaf(home, 'Home.md'),
			createLeaf(graph, null),
		];
		const snapshot = readHostSnapshot(
			{
				getLeavesOfType: () => [],
				iterateAllLeaves: (callback) => leaves.forEach(callback),
			},
			() => true,
		);
		const adapter = track(new TabAdapter(resolveTestColor, () => {}));
		adapter.refresh(snapshot.tabs);
		expect(
			[alpha, alphaDuplicate, beta].map((header) =>
				header.classList.contains('cfft-tab-color'),
			),
		).toEqual([true, true, true]);
		for (const header of [alpha, alphaDuplicate, beta, home])
			expect(
				header.querySelector('.cfft-type-icon .lucide-file-text'),
			).not.toBeNull();
		expect(graph.querySelector('.cfft-type-icon')).toBeNull();
		expect(home.matches('.cfft-explorer-color, .cfft-tab-color')).toBe(
			false,
		);
		expect(graph.matches('.cfft-explorer-color, .cfft-tab-color')).toBe(
			false,
		);
	});

	it('clears a header reused for a neutral file or a non-file view with a misleading state', () => {
		const header = createTabs().header();
		const leaf = createLeaf(header, 'Projects/Projects.md');
		const adapter = track(new TabAdapter(resolveTestColor, () => {}));
		const refresh = () => {
			const target = readTabTarget(leaf, () => true);
			adapter.refresh(target ? [target] : []);
		};
		refresh();
		expect(header.classList.contains('cfft-tab-color')).toBe(true);
		leaf.view = new FileView('Home.md');
		refresh();
		expect(header.classList.contains('cfft-tab-color')).toBe(false);
		leaf.view = new FileView('Projects/Projects.md');
		refresh();
		leaf.view = { getState: () => ({ file: 'Projects/Projects.md' }) };
		refresh();
		expect(header.matches('.cfft-explorer-color, .cfft-tab-color')).toBe(
			false,
		);
	});

	it('identifies deferred built-in file views from state without waking them', () => {
		const leaf = createLeaf(createTabs().header(), null);
		leaf.isDeferred = true;
		leaf.getViewState = () => ({
			type: 'markdown',
			state: { file: 'Projects/Projects.md' },
		});
		expect(readTabTarget(leaf, () => true)?.filePath).toBe(
			'Projects/Projects.md',
		);
		leaf.getViewState = () => ({
			type: 'graph',
			state: { file: 'Projects/Projects.md' },
		});
		expect(readTabTarget(leaf, () => true)?.filePath).toBeNull();
	});

	it('keeps missing files and empty FileViews neutral', () => {
		const leaf = createLeaf(createTabs().header(), 'Projects/Deleted.md');
		expect(readTabTarget(leaf, () => false)?.filePath).toBeNull();
		leaf.view = new FileView(null);
		expect(readTabTarget(leaf, () => true)?.filePath).toBeNull();
	});

	it('identifies a deferred native Base and adds its database glyph without waking the view', () => {
		const leaf = createLeaf(createTabs().header('Collection'), null);
		leaf.isDeferred = true;
		leaf.getViewState = () => ({
			type: 'bases',
			state: { file: 'Projects/Collection.base' },
		});
		const originalView = leaf.view;
		const target = readTabTarget(leaf, () => true);
		expect(target?.filePath).toBe('Projects/Collection.base');
		const adapter = track(new TabAdapter(resolveTestColor, () => {}));
		adapter.refresh(target ? [target] : []);
		expect(
			target?.element.querySelector('.cfft-type-icon .lucide-database'),
		).not.toBeNull();
		expect(leaf.view).toBe(originalView);
		expect(leaf.isDeferred).toBe(true);
	});

	it('skips absent, malformed, disconnected, wrong-document, or throwing internal headers', () => {
		const header = createTabs().header();
		const leaf = createLeaf(header, 'Projects/Projects.md');
		const { tabHeaderEl: omitted, ...publicLeaf } = leaf;
		expect(omitted).toBe(header);
		expect(readTabTarget(publicLeaf, () => true)).toBeNull();
		leaf.tabHeaderEl = 'README';
		expect(readTabTarget(leaf, () => true)).toBeNull();
		leaf.tabHeaderEl = document.createElement('div');
		expect(readTabTarget(leaf, () => true)).toBeNull();
		leaf.tabHeaderEl = header;
		leaf.getContainer = () => ({
			doc: document.implementation.createHTMLDocument(),
		});
		expect(readTabTarget(leaf, () => true)).toBeNull();
		Object.defineProperty(leaf, 'tabHeaderEl', {
			get: () => {
				throw new Error('Disposed');
			},
		});
		expect(readTabTarget(leaf, () => true)).toBeNull();
	});

	it('handles hosts without Explorer leaves or tab headers', () => {
		expect(
			readHostSnapshot(
				{
					getLeavesOfType: () => [],
					iterateAllLeaves: () => {},
				},
				() => false,
			),
		).toEqual({ explorerRoots: [], tabs: [] });
	});
});
