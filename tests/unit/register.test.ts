import type { Plugin } from 'obsidian';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { registerHostIntegration } from '../../src/adapters/register';
import { resolveTestColor } from '../fixtures/colors';
import { createExplorer, createTabs, ManualFrames } from '../fixtures/dom';
import { FileView, TFile } from '../fixtures/obsidian';
import { installObsidianDom } from '../fixtures/dom-support';

let restoreDom: () => void;
const cleanups: (() => void)[] = [];
beforeEach(() => {
	restoreDom = installObsidianDom();
});
afterEach(() => {
	for (const cleanup of cleanups.splice(0)) cleanup();
	document.body.replaceChildren();
	restoreDom();
});

/** The cold-start workspace has no root split until Obsidian restores its layout. */
function coldWorkspace() {
	const explorer = createExplorer();
	const row = explorer.row('Projects/Project-Alpha/README.md');
	const header = createTabs().header();
	const frames = new ManualFrames();
	const ready: (() => void)[] = [];
	const listeners = new Map<string, () => void>();
	const leaf = {
		view: new FileView('Projects/Project-Alpha/README.md'),
		isDeferred: false,
		tabHeaderEl: header,
		getViewState: () => ({ type: 'markdown' }),
		getContainer: () => ({ doc: document }),
	};
	const workspace = {
		rootSplit: undefined as { win: ManualFrames } | undefined,
		on: (name: string, callback: () => void) => {
			listeners.set(name, callback);
			return () => listeners.delete(name);
		},
		onLayoutReady: (callback: () => void) => ready.push(callback),
		getLeavesOfType: () => [{ view: { containerEl: explorer.root } }],
		iterateAllLeaves: (callback: (value: typeof leaf) => void) =>
			callback(leaf),
	};
	const boundary = {
		app: {
			workspace,
			vault: {
				on: workspace.on,
				getAbstractFileByPath: (path: string) => new TFile(path),
			},
		},
		register: (cleanup: () => void) => cleanups.push(cleanup),
		registerEvent: (cleanup: () => void) => cleanups.push(cleanup),
	};
	return {
		// Only metadata and lifecycle APIs used by this adapter are supplied.
		plugin: boundary as unknown as Plugin,
		row,
		header,
		frames,
		refreshBeforeLayout: () => {
			listeners.get('layout-change')?.();
		},
		restoreLayout: () => {
			workspace.rootSplit = { win: frames };
			for (const callback of ready) callback();
		},
	};
}

describe('host registration during cold startup', () => {
	it('waits for the restored root split and decorates rows and tabs', () => {
		const host = coldWorkspace();
		registerHostIntegration(host.plugin, resolveTestColor);
		host.refreshBeforeLayout();
		expect(host.frames.pending).toBe(0);
		host.restoreLayout();
		host.frames.run();
		for (const element of [host.row, host.header])
			expect(
				element.matches('.cfft-explorer-color, .cfft-tab-color'),
			).toBe(true);
	});

	it('does not access the root split or schedule a frame after unloading', () => {
		const host = coldWorkspace();
		registerHostIntegration(host.plugin, resolveTestColor);
		for (const cleanup of cleanups.splice(0)) cleanup();
		host.restoreLayout();
		expect(host.frames.pending).toBe(0);
		expect(host.header.querySelector('.cfft-type-icon')).toBeNull();
	});
});
