import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { HostDecorationController } from '../../src/adapters/controller';
import { assignFolder } from '../../src/model/changes';
import { defaultSettings } from '../../src/model/settings';
import { SettingsStore } from '../../src/settings/store';
import {
	createExplorer,
	createTabs,
	ManualFrames,
	setHostStyles,
} from '../fixtures/dom';
import { MemorySettings } from '../fixtures/settings';
import { installObsidianDom } from '../fixtures/dom-support';

let restoreDom: () => void;
const cleanups: (() => void)[] = [];
beforeEach(() => {
	restoreDom = installObsidianDom();
	document.body.className = 'theme-dark';
	setHostStyles(document.body, { 'background-color': '#282828' });
});
afterEach(() => {
	for (const cleanup of cleanups.splice(0)) cleanup();
	document.body.replaceChildren();
	document.body.removeAttribute('class');
	document.body.removeAttribute('style');
	restoreDom();
});

/** Use resolvable hex seeds because jsdom does not inherit the host's CSS theme tokens. */
function hexSettings() {
	const defaults = defaultSettings();
	return {
		...defaults,
		palette: defaults.palette.map((color) => ({
			...color,
			seed:
				color.id === 'red'
					? ('#e05252' as const)
					: ('#8b6cef' as const),
		})),
	};
}

describe('settings model in both host adapters', () => {
	it('refreshes visible rows and every matching file tab after assignments and palette edits', async () => {
		const storage = new MemorySettings(hexSettings());
		const store = new SettingsStore(storage);
		await store.reload();
		const explorer = createExplorer();
		const folder = explorer.row('A', 'folder');
		const note = explorer.row('A/B/Note.md');
		const loose = explorer.row('Home.md');
		const headers = createTabs();
		const first = headers.header();
		const second = headers.header();
		const frames = new ManualFrames();
		const controller = new HostDecorationController(
			() => ({
				explorerRoots: [explorer.root],
				tabs: [first, second].map((element) => ({
					element,
					filePath: 'A/B/Note.md',
				})),
			}),
			store.resolve,
			frames,
		);
		cleanups.push(
			() => controller.dispose(),
			() => store.dispose(),
			store.subscribe(controller.requestRefresh),
		);
		controller.start();
		frames.run();
		expect(note.style.getPropertyValue('--cfft-icon')).toBe('');
		await store.setAssignment('A', 'red');
		frames.run();
		const family = new Map(
			[folder, note, first, second].map((element) => [
				element,
				element.style.getPropertyValue('--cfft-icon'),
			]),
		);
		for (const color of family.values())
			expect(color).toMatch(/^#[\da-f]{6}$/);
		expect(first.style.getPropertyValue('--cfft-icon')).toBe(
			second.style.getPropertyValue('--cfft-icon'),
		);
		expect(loose.style.getPropertyValue('--cfft-icon')).toBe('');
		await store.setAssignment('A/B', 'blue');
		await store.putColor({ id: 'blue', name: 'Ocean', seed: '#123456' });
		frames.run();
		for (const element of [note, first, second])
			expect(element.style.getPropertyValue('--cfft-icon')).not.toBe(
				family.get(element),
			);
		expect(folder.style.getPropertyValue('--cfft-icon')).toBe(
			family.get(folder),
		);
		await store.removeColor('blue');
		frames.run();
		for (const element of [note, first, second])
			expect(element.style.getPropertyValue('--cfft-icon')).toBe(
				family.get(element),
			);
		storage.data = defaultSettings();
		await store.reload();
		frames.run();
		for (const element of [folder, note, first, second])
			expect(element.style.getPropertyValue('--cfft-icon')).toBe('');
	});

	it('keeps an assigned moved folder and its open tab colored under the new path', async () => {
		const store = new SettingsStore(
			new MemorySettings(
				assignFolder(hexSettings(), 'A/Nested', 'purple'),
			),
		);
		await store.reload();
		const explorer = createExplorer();
		const folder = explorer.row('A/Nested', 'folder');
		const note = explorer.row('A/Nested/Note.md');
		const header = createTabs().header();
		let filePath = 'A/Nested/Note.md';
		const frames = new ManualFrames();
		const controller = new HostDecorationController(
			() => ({
				explorerRoots: [explorer.root],
				tabs: [{ element: header, filePath }],
			}),
			store.resolve,
			frames,
		);
		cleanups.push(
			() => controller.dispose(),
			() => store.dispose(),
			store.subscribe(controller.requestRefresh),
		);
		controller.start();
		frames.run();
		const family = new Map(
			[folder, note, header].map((element) => [
				element,
				element.style.getPropertyValue('--cfft-icon'),
			]),
		);
		for (const color of family.values())
			expect(color).toMatch(/^#[\da-f]{6}$/);
		folder.setAttribute('data-path', 'B/Moved');
		note.setAttribute('data-path', 'B/Moved/Note.md');
		filePath = 'B/Moved/Note.md';
		await store.moveFolder('A/Nested', 'B/Moved');
		frames.run();
		for (const element of [folder, note, header])
			expect(element.style.getPropertyValue('--cfft-icon')).toBe(
				family.get(element),
			);
		expect(store.settings.assignments).toEqual({ 'B/Moved': 'purple' });
		expect(
			store.resolve({ path: 'A/Nested/Note.md', kind: 'file' }),
		).toBeNull();
	});
});
