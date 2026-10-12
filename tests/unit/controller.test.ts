import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { HostSnapshot } from '../../src/adapters/contracts';
import { HostDecorationController } from '../../src/adapters/controller';
import { resolveTestColor } from '../fixtures/colors';
import { createExplorer, createTabs, ManualFrames } from '../fixtures/dom';
import { installObsidianDom } from '../fixtures/dom-support';

let restoreDom: () => void;
const controllers: HostDecorationController[] = [];
beforeEach(() => {
	restoreDom = installObsidianDom();
});
afterEach(() => {
	for (const controller of controllers.splice(0)) controller.dispose();
	document.body.replaceChildren();
	restoreDom();
});

/** Retain a controller for cleanup even after failed assertions. */
function track(controller: HostDecorationController): HostDecorationController {
	controllers.push(controller);
	return controller;
}

describe('host refresh and cleanup', () => {
	it('coalesces event bursts and ignores its own class and property writes', async () => {
		const explorer = createExplorer();
		explorer.row('Projects/Projects.md');
		const snapshot = vi.fn(() => ({
			explorerRoots: [explorer.root],
			tabs: [],
		}));
		const frames = new ManualFrames();
		const controller = track(
			new HostDecorationController(snapshot, resolveTestColor, frames),
		);
		controller.start();
		for (let i = 0; i < 10; i++) controller.requestRefresh();
		expect(frames.pending).toBe(1);
		frames.run();
		await Promise.resolve();
		expect(snapshot).toHaveBeenCalledTimes(1);
		expect(frames.pending).toBe(0);
		const editor = document.createElement('div');
		document.body.append(editor);
		editor.textContent = 'Unrelated editor mutation';
		await Promise.resolve();
		expect(frames.pending).toBe(0);
	});

	it('restores decoration after the host rewrites a row class without changing its path', async () => {
		const explorer = createExplorer();
		const row = explorer.row('Projects/Projects.md');
		const originalClass = row.className;
		const frames = new ManualFrames();
		const controller = track(
			new HostDecorationController(
				() => ({ explorerRoots: [explorer.root], tabs: [] }),
				resolveTestColor,
				frames,
			),
		);
		controller.start();
		frames.run();
		row.className = originalClass;
		await Promise.resolve();
		expect(frames.pending).toBe(1);
		frames.run();
		expect(row.classList.contains('cfft-explorer-color')).toBe(true);
		await Promise.resolve();
		expect(frames.pending).toBe(0);
	});

	it('refreshes reused identities, newly rendered rows, and collapse/expand mutations', async () => {
		const explorer = createExplorer();
		const row = explorer.row('Projects/Projects.md');
		const frames = new ManualFrames();
		const controller = track(
			new HostDecorationController(
				() => ({ explorerRoots: [explorer.root], tabs: [] }),
				resolveTestColor,
				frames,
			),
		);
		controller.start();
		frames.run();
		await Promise.resolve();
		row.setAttribute('data-path', 'Work/Work.md');
		await Promise.resolve();
		expect(frames.pending).toBe(1);
		frames.run();
		expect(row.matches('.cfft-explorer-color, .cfft-tab-color')).toBe(
			false,
		);
		const newRow = explorer.row('Projects/Project-Alpha/README.md');
		await Promise.resolve();
		frames.run();
		expect(newRow.classList.contains('cfft-explorer-color')).toBe(true);
		newRow.remove();
		await Promise.resolve();
		frames.run();
		expect(newRow.matches('.cfft-explorer-color, .cfft-tab-color')).toBe(
			false,
		);
		explorer.root.append(newRow);
		await Promise.resolve();
		frames.run();
		expect(newRow.matches('.cfft-explorer-color, .cfft-tab-color')).toBe(
			true,
		);
	});

	it('disconnects replaced Explorer roots and decorates the new layout', async () => {
		const oldExplorer = createExplorer();
		const oldRow = oldExplorer.row('Projects/Projects.md');
		let roots = [oldExplorer.root];
		const frames = new ManualFrames();
		const controller = track(
			new HostDecorationController(
				() => ({ explorerRoots: roots, tabs: [] }),
				resolveTestColor,
				frames,
			),
		);
		controller.start();
		frames.run();
		await Promise.resolve();
		const nextExplorer = createExplorer();
		const nextRow = nextExplorer.row('Projects/Projects.md');
		roots = [nextExplorer.root];
		controller.requestRefresh();
		frames.run();
		await Promise.resolve();
		expect(oldRow.matches('.cfft-explorer-color, .cfft-tab-color')).toBe(
			false,
		);
		expect(nextRow.matches('.cfft-explorer-color, .cfft-tab-color')).toBe(
			true,
		);
		oldRow.setAttribute('data-path', 'Projects/Renamed.md');
		await Promise.resolve();
		expect(frames.pending).toBe(0);
	});

	it('refreshes new headers and clears host animation clones that have no leaf', async () => {
		const tabs = createTabs();
		const header = tabs.header();
		const snapshot: HostSnapshot = {
			explorerRoots: [],
			tabs: [{ element: header, filePath: 'Projects/Projects.md' }],
		};
		const frames = new ManualFrames();
		const controller = track(
			new HostDecorationController(
				() => snapshot,
				resolveTestColor,
				frames,
			),
		);
		controller.start();
		frames.run();
		await Promise.resolve();
		const clone = header.cloneNode(true);
		header.after(clone);
		const next = tabs.header();
		snapshot.tabs = [
			...snapshot.tabs,
			{ element: next, filePath: 'Projects/Project-Beta/README.md' },
		];
		await Promise.resolve();
		frames.run();
		expect(tabs.root.querySelectorAll('.cfft-tab-color')).toHaveLength(2);
		expect(next.matches('.cfft-explorer-color, .cfft-tab-color')).toBe(
			true,
		);
		expect(
			header.nextElementSibling?.classList.contains('cfft-tab-color'),
		).toBe(false);
		expect(
			header.nextElementSibling?.querySelector('.cfft-type-icon'),
		).toBeNull();
	});

	it('cleans detached rows, copied headers, queued frames, and pop-out documents on unload', async () => {
		const explorer = createExplorer();
		const row = explorer.row('Projects/Projects.md');
		const iframe = document.createElement('iframe');
		document.body.append(iframe);
		const popoutDoc = iframe.contentDocument;
		if (!popoutDoc) throw new Error('Missing fixture document');
		const popoutExplorer = createExplorer(popoutDoc);
		const popoutRow = popoutExplorer.row(
			'Projects/Project-Alpha/README.md',
		);
		const popoutTabs = createTabs(popoutDoc);
		const header = popoutTabs.header();
		const mainTabs = createTabs();
		const mainHeader = mainTabs.header();
		const frames = new ManualFrames();
		const controller = track(
			new HostDecorationController(
				() => ({
					explorerRoots: [explorer.root, popoutExplorer.root],
					tabs: [
						{ element: header, filePath: 'Projects/Projects.md' },
						{
							element: mainHeader,
							filePath: 'Projects/Projects.md',
						},
					],
				}),
				resolveTestColor,
				frames,
			),
		);
		controller.start();
		frames.run();
		await Promise.resolve();
		expect(popoutRow.matches('.cfft-explorer-color, .cfft-tab-color')).toBe(
			true,
		);
		row.remove();
		header.after(header.cloneNode(true));
		mainHeader.after(mainHeader.cloneNode(true));
		// The host may adopt nodes into an unobserved document before the next frame.
		const adoptedDoc = document.implementation.createHTMLDocument();
		adoptedDoc.body.append(adoptedDoc.adoptNode(mainTabs.root));
		mainTabs.root.remove();
		controller.requestRefresh();
		expect(frames.pending).toBe(1);
		controller.dispose();
		await Promise.resolve();
		expect(frames.pending).toBe(0);
		expect(frames.cancelAnimationFrame).toHaveBeenCalledOnce();
		expect(row.matches('.cfft-explorer-color, .cfft-tab-color')).toBe(
			false,
		);
		expect(row.querySelector('.cfft-type-icon')).toBeNull();
		expect(
			popoutDoc.querySelectorAll(
				'.cfft-explorer-color, .cfft-tab-color, .cfft-type-icon',
			),
		).toHaveLength(0);
		expect(popoutRow.matches('.cfft-explorer-color, .cfft-tab-color')).toBe(
			false,
		);
		expect(header.matches('.cfft-explorer-color, .cfft-tab-color')).toBe(
			false,
		);
		expect(
			mainTabs.root.querySelectorAll('.cfft-tab-color, .cfft-type-icon'),
		).toHaveLength(0);
		popoutRow.setAttribute('data-path', 'Projects/Renamed.md');
		controller.start();
		controller.requestRefresh();
		await Promise.resolve();
		expect(frames.pending).toBe(0);
	});

	it('releases a closing pop-out and leaves the main document colored', async () => {
		const explorer = createExplorer();
		const row = explorer.row('Projects/Projects.md');
		const iframe = document.createElement('iframe');
		document.body.append(iframe);
		const doc = iframe.contentDocument;
		if (!doc) throw new Error('Missing fixture document');
		const popout = createExplorer(doc);
		const popoutRow = popout.row('Projects/Projects.md');
		const frames = new ManualFrames();
		const controller = track(
			new HostDecorationController(
				() => ({
					explorerRoots: [explorer.root, popout.root],
					tabs: [],
				}),
				resolveTestColor,
				frames,
			),
		);
		controller.start();
		frames.run();
		await Promise.resolve();
		controller.releaseDocument(doc);
		expect(popoutRow.matches('.cfft-explorer-color, .cfft-tab-color')).toBe(
			false,
		);
		expect(row.matches('.cfft-explorer-color, .cfft-tab-color')).toBe(true);
		popoutRow.setAttribute('data-path', 'Projects/Renamed.md');
		await Promise.resolve();
		expect(frames.pending).toBe(0);
		// A close event can precede the host removing its old leaves from enumeration.
		controller.requestRefresh();
		frames.run();
		expect(popoutRow.matches('.cfft-explorer-color, .cfft-tab-color')).toBe(
			false,
		);
		expect(row.matches('.cfft-explorer-color, .cfft-tab-color')).toBe(true);
	});

	it('does not start from a layout-ready callback delivered after unload', () => {
		const frames = new ManualFrames();
		const snapshot = vi.fn(() => ({ explorerRoots: [], tabs: [] }));
		const controller = track(
			new HostDecorationController(snapshot, resolveTestColor, frames),
		);
		controller.dispose();
		controller.start();
		frames.run();
		expect(snapshot).not.toHaveBeenCalled();
		expect(frames.pending).toBe(0);
	});
});
