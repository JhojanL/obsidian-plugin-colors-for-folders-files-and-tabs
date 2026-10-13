import type { App } from 'obsidian';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { assignFolder } from '../../src/model/changes';
import { defaultSettings } from '../../src/model/settings';
import { SettingsStore } from '../../src/settings/store';
import { ColorWorkflow } from '../../src/settings/workflow';
import { readColorDraft } from '../../src/ui/color-draft';
import { FolderChooser } from '../../src/ui/folder-chooser';
import { TFile, TFolder } from '../fixtures/obsidian';
import { MemorySettings, deferred } from '../fixtures/settings';
import {
	installObsidianDom,
	requireElement,
	setHostStyles,
} from '../fixtures/dom-support';

let restoreDom: () => void;
const cleanups: (() => void)[] = [];
beforeEach(() => {
	restoreDom = installObsidianDom();
});
afterEach(() => {
	for (const cleanup of cleanups.splice(0).reverse()) cleanup();
	document.body.replaceChildren();
	restoreDom();
});

/** Create metadata-only host services using stored data (null uses defaults); register store/dialog cleanup after each test. */
async function fixture(data: unknown = null) {
	const files = [
		new TFolder('/'),
		new TFolder('Projects'),
		new TFolder('Projects/Empty'),
		new TFolder('Archive'),
		new TFile('Projects/Note.md'),
	];
	const workspace = {
		on: vi.fn((_event: string, _callback: () => void) => () => {}),
	};
	const app = {
		workspace,
		vault: {
			getAllFolders: () =>
				files.filter((file) => file instanceof TFolder),
			getAbstractFileByPath: (path: string) =>
				files.find((file) => file.path === path) ?? null,
		},
	} as unknown as App;
	const storage = new MemorySettings(data);
	const store = new SettingsStore(storage);
	await store.reload();
	const workflow = new ColorWorkflow(app, store);
	cleanups.push(() => {
		workflow.dispose();
		store.dispose();
	});
	return { app, files, storage, store, workflow, workspace };
}

/** Require the most recently opened dialog's button with visible text name. */
function button(name: string): HTMLButtonElement {
	const matches = Array.from(
		document.querySelectorAll<HTMLButtonElement>('button'),
	).filter((element) => element.textContent === name);
	const found = matches.pop();
	if (!found) throw new Error(`Missing button: ${name}`);
	return found;
}

/** Set value on the latest input labeled name and dispatch its public input event for draft synchronization. */
function input(name: string, value: string): HTMLInputElement {
	const matches = Array.from(
		document.querySelectorAll<HTMLInputElement>('input'),
	).filter((element) => element.getAttribute('aria-label') === name);
	const found = matches.pop();
	if (!found) throw new Error(`Missing input: ${name}`);
	found.value = value;
	found.dispatchEvent(new Event('input', { bubbles: true }));
	return found;
}

describe('custom color input', () => {
	it.each(['#abc', '#12GG00', '#12345678', 'var(--color-red)', ''])(
		'rejects invalid hex %j without accepting alternate CSS syntax',
		(hex) => {
			expect(readColorDraft('custom-1', 'Valid name', hex)).toEqual({
				color: null,
				nameError: '',
				hexError: 'Enter six hex digits, such as #8b6cef.',
			});
		},
	);
	it('normalizes both picker and text values through the same rule, and rejects whitespace names', () => {
		expect(
			readColorDraft('custom-1', '  Mine  ', ' #ABCDEF ').color,
		).toEqual({ id: 'custom-1', name: 'Mine', seed: '#abcdef' });
		expect(readColorDraft('custom-1', '  ', '#abcdef').nameError).toBe(
			'Enter a color name.',
		);
	});
	it('disables Apply for invalid input, shows inline errors, and discards canceled changes', async () => {
		const { workflow, store, storage } = await fixture();
		workflow.editColor();
		expect(button('Apply').disabled).toBe(true);
		button('Apply').click();
		expect(document.activeElement?.getAttribute('aria-label')).toBe(
			'Color name',
		);
		input('Color name', '   ');
		expect(document.body.textContent).toContain('Enter a color name.');
		input('Color name', 'My color');
		expect(button('Apply').disabled).toBe(false);
		input('Hex color', '#oops');
		expect(button('Apply').disabled).toBe(true);
		button('Apply').click();
		expect(input('Hex color', '#oops').getAttribute('aria-invalid')).toBe(
			'true',
		);
		expect(document.body.textContent).toContain('Enter six hex digits');
		button('Cancel').click();
		expect(store.settings.palette).toEqual(defaultSettings().palette);
		expect(storage.saveData).not.toHaveBeenCalled();
	});
	it.each([
		[
			'Sky blue',
			'#2468ac',
			'Color name',
			'A color named "Sky Blue" already exists.',
		],
		[
			'Different name',
			' #AABBCC ',
			'Hex color',
			'This color already exists as "Sky Blue".',
		],
		[
			'Different name',
			'#00C4C4',
			'Hex color',
			'This color already exists as "Cyan".',
		],
	])(
		'blocks duplicate %j / %j with a specific inline error',
		async (name, hex, field, error) => {
			const defaults = defaultSettings();
			const { workflow, store, storage } = await fixture({
				...defaults,
				palette: [
					...defaults.palette,
					{ id: 'sky', name: 'Sky Blue', seed: '#aabbcc' },
					{ id: 'gray', name: 'gris', seed: '#777777' },
					{ id: 'cafe', name: 'Café', seed: '#123456' },
				],
			});
			const before = store.settings;
			workflow.editColor();
			setHostStyles(
				requireElement<HTMLElement>(document, '.cfft-color-preview'),
				{
					'--color-cyan': '#00c4c4',
				},
			);
			input('Color name', name);
			input('Hex color', hex);
			const invalid = requireElement<HTMLInputElement>(
				document,
				`[aria-label="${field}"]`,
			);
			expect(invalid.getAttribute('aria-invalid')).toBe('true');
			expect(
				document.getElementById(
					invalid.getAttribute('aria-describedby')!,
				)?.textContent,
			).toBe(error);
			expect(button('Apply').disabled).toBe(true);
			button('Apply').click();
			await store.flush();
			expect(store.settings).toBe(before);
			expect(storage.saveData).not.toHaveBeenCalled();
			input('Color name', 'Available name');
			input('Hex color', '#2468ac');
			expect(button('Apply').disabled).toBe(false);
			expect(
				document.querySelectorAll('[aria-invalid="true"]'),
			).toHaveLength(0);
			button('Cancel').click();
		},
	);
	it('preserves trimmed display text through add/edit and keeps assignments by ID', async () => {
		const name = '  AzuL  marino  ';
		const { workflow, store } = await fixture();
		workflow.editColor();
		input('Color name', name);
		input('Hex color', '#AABBCC');
		button('Apply').click();
		await store.flush();
		const color =
			store.settings.palette[store.settings.palette.length - 1]!;
		expect(color.name).toBe(name.trim());
		expect(color.id).toMatch(/^custom-/);
		await workflow.assign('Projects', color.id);
		workflow.editColor(color);
		input('Color name', `  ${name.trim()}  `);
		input('Hex color', ' #AABBCC ');
		expect(button('Apply').disabled).toBe(false);
		button('Apply').click();
		await store.flush();
		expect(
			store.settings.palette.find((entry) => entry.id === color.id),
		).toEqual(color);
		expect(store.settings.assignments).toEqual({ Projects: color.id });
	});
	it('blocks duplicate picker values and synchronizes the hex field before validation', async () => {
		const { workflow } = await fixture({
			...defaultSettings(),
			palette: [{ id: 'sky', name: 'Sky Blue', seed: '#aabbcc' }],
		});
		workflow.editColor();
		input('Color name', 'Different name');
		const picker = input('Color picker', '#aabbcc');
		expect(
			document.querySelector<HTMLInputElement>('[aria-label="Hex color"]')
				?.value,
		).toBe('#aabbcc');
		expect(picker.getAttribute('aria-invalid')).toBe('true');
		expect(document.body.textContent).toContain(
			'This color already exists as "Sky Blue".',
		);
		expect(button('Apply').disabled).toBe(true);
		input('Color picker', '#2468ac');
		expect(picker.getAttribute('aria-invalid')).toBe('false');
		expect(button('Apply').disabled).toBe(false);
	});
	it('revalidates an open draft when the palette changes', async () => {
		const { workflow, store } = await fixture();
		workflow.editColor();
		input('Color name', 'Available name');
		input('Hex color', '#2468ac');
		expect(button('Apply').disabled).toBe(false);
		await store.putColor({
			id: 'incoming',
			name: 'AVAILABLE NAME',
			seed: '#123456',
		});
		expect(button('Apply').disabled).toBe(true);
		expect(document.body.textContent).toContain(
			'A color named "AVAILABLE NAME" already exists.',
		);
		await store.removeColor('incoming');
		expect(button('Apply').disabled).toBe(false);
	});
	it('revalidates built-in hex conflicts when theme CSS changes', async () => {
		const { workflow, workspace } = await fixture();
		workflow.editColor();
		const sample = requireElement<HTMLElement>(
			document,
			'.cfft-color-preview',
		);
		setHostStyles(sample, { '--color-cyan': '#00c4c4' });
		input('Color name', 'Available name');
		input('Hex color', '#2468ac');
		expect(button('Apply').disabled).toBe(false);
		setHostStyles(sample, { '--color-cyan': '#2468ac' });
		for (const [event, callback] of workspace.on.mock.calls)
			if (event === 'css-change') callback();
		expect(button('Apply').disabled).toBe(true);
		expect(document.body.textContent).toContain(
			'This color already exists as "Cyan".',
		);
		setHostStyles(sample, { '--color-cyan': '#00c4c4' });
		for (const [event, callback] of workspace.on.mock.calls)
			if (event === 'css-change') callback();
		expect(button('Apply').disabled).toBe(false);
	});
	it('synchronizes picker/hex, preserves a failed draft, and retries with the same stable color ID', async () => {
		const { workflow, store, storage } = await fixture();
		workflow.editColor();
		input('Color name', 'My custom');
		input('Color picker', '#123456');
		expect(
			document.querySelector<HTMLInputElement>('[aria-label="Hex color"]')
				?.value,
		).toBe('#123456');
		storage.saveData.mockRejectedValueOnce(new Error('Disk unavailable'));
		button('Apply').click();
		await store.flush();
		expect(document.body.textContent).toContain('Unsaved changes are kept');
		expect(document.querySelector('.cfft-modal')).not.toBeNull();
		const id = store.settings.palette.find(
			(color) => color.name === 'My custom',
		)?.id;
		expect(store.hasUnsavedChanges).toBe(true);
		button('Apply').click();
		await store.flush();
		expect(document.querySelector('.cfft-modal')).toBeNull();
		expect(
			store.settings.palette.filter((color) => color.id === id),
		).toEqual([{ id, name: 'My custom', seed: '#123456' }]);
		expect(storage.saves[0]?.palette).toEqual(store.settings.palette);
		expect(store.hasUnsavedChanges).toBe(false);
	});
	it('finishes a submitted save after closing the editor without restarting its appearance observers', async () => {
		const { workflow, store, storage } = await fixture();
		workflow.editColor();
		input('Color name', 'Available name');
		input('Hex color', '#2468ac');
		const started = deferred<void>();
		const read = deferred<unknown>();
		storage.loadData.mockImplementationOnce(() => {
			started.resolve();
			return read.promise;
		});
		button('Apply').click();
		await started.promise;
		button('Cancel').click();
		const observe = vi.spyOn(window.MutationObserver.prototype, 'observe');
		read.resolve(null);
		await store.flush();
		expect(document.querySelector('.cfft-modal')).toBeNull();
		expect(
			store.settings.palette.find(
				(color) => color.name === 'Available name',
			)?.seed,
		).toBe('#2468ac');
		expect(observe).not.toHaveBeenCalled();
	});
	it('retains a theme token on name-only edits and changes to hex only when a color input is edited', async () => {
		const { workflow, store } = await fixture();
		workflow.editColor(store.settings.palette[0]);
		input('Color name', 'Theme red renamed');
		button('Apply').click();
		await store.flush();
		expect(store.settings.palette[0]?.seed).toBe('--color-red');
		workflow.editColor(store.settings.palette[0]);
		input('Hex color', '#abcdef');
		button('Apply').click();
		await store.flush();
		expect(store.settings.palette[0]).toEqual({
			id: 'red',
			name: 'Theme red renamed',
			seed: '#abcdef',
		});
	});
});

describe('folder assignment and palette management', () => {
	it('keeps a missing-folder rejection separate from unsaved persistence', async () => {
		const { workflow, store, storage, files } = await fixture();
		workflow.openAssignment('Projects');
		requireElement<HTMLButtonElement>(
			document,
			'[aria-label="Purple"]',
		).click();
		files.splice(
			files.findIndex((file) => file.path === 'Projects'),
			1,
		);
		button('Apply').click();
		await store.flush();
		await Promise.resolve();
		expect(document.querySelector('.cfft-error')?.textContent).toContain(
			'Choose it again.',
		);
		expect(
			document.querySelector('.cfft-error')?.textContent,
		).not.toContain('Retry saving');
		expect(
			document.querySelector('.cfft-error')?.textContent,
		).not.toContain('changes are kept');
		expect(store.settings.assignments).toEqual({});
		expect(store.hasUnsavedChanges).toBe(false);
		expect(storage.saveData).not.toHaveBeenCalled();
		expect(storage.data).toBeNull();
	});
	it('explains an externally canceled edit without offering persistence retry', async () => {
		const { workflow, store, storage } = await fixture();
		workflow.openAssignment('Projects');
		requireElement<HTMLButtonElement>(
			document,
			'[aria-label="Purple"]',
		).click();
		const started = deferred<void>();
		const read = deferred<unknown>();
		storage.loadData.mockImplementationOnce(() => {
			started.resolve();
			return read.promise;
		});
		button('Apply').click();
		await started.promise;
		const external = assignFolder(defaultSettings(), 'Archive', 'blue');
		storage.data = external;
		const reload = store.reload();
		read.resolve(null);
		await reload;
		expect(document.querySelector('.cfft-error')?.textContent).toContain(
			'retry the edit',
		);
		expect(
			document.querySelector('.cfft-error')?.textContent,
		).not.toContain('Retry saving');
		expect(store.settings.assignments).toEqual({ Archive: 'blue' });
		expect(store.hasUnsavedChanges).toBe(false);
		expect(storage.data).toBe(external);
		expect(storage.saveData).not.toHaveBeenCalled();
	});
	it('returns focus to an enabled control in the originating pop-out when its trigger is removed', async () => {
		const { workflow } = await fixture();
		const frame = document.createElement('iframe');
		document.body.append(frame);
		const origin = frame.contentDocument!;
		Object.defineProperty(window, 'activeDocument', {
			value: origin,
			configurable: true,
		});
		const root = origin.createElement('div');
		root.className = 'cfft-controls';
		origin.body.append(root);
		const add = origin.createElement('button');
		add.textContent = 'Add color';
		const remove = origin.createElement('button');
		remove.dataset.cfftFocus = 'delete-blue';
		root.append(add, remove);
		remove.focus();
		workflow.removeColor('blue');
		remove.remove();
		button('Cancel').click();
		await Promise.resolve();
		expect(origin.activeElement).toBe(add);
	});
	it('lists empty folders by full path, excluding notes and the vault root', async () => {
		const { workflow } = await fixture();
		const chooser = new FolderChooser(workflow);
		expect(
			chooser.getSuggestions('EMPTY').map((folder) => folder.path),
		).toEqual(['Projects/Empty']);
		expect(chooser.getSuggestions('').map((folder) => folder.path)).toEqual(
			['Archive', 'Projects', 'Projects/Empty'],
		);
	});
	it('refreshes folder suggestions after metadata changes without enumerating files', async () => {
		const { workflow, app, files } = await fixture();
		const enumerateFiles = vi.fn(() => {
			throw new Error('Folder selection must not enumerate files.');
		});
		app.vault.getAllLoadedFiles = enumerateFiles;
		const chooser = new FolderChooser(workflow);
		expect(chooser.getSuggestions('new')).toEqual([]);
		files.push(new TFolder('Projects/New empty folder'));
		expect(
			chooser.getSuggestions(' NEW ').map((folder) => folder.path),
		).toEqual(['Projects/New empty folder']);
		expect(enumerateFiles).not.toHaveBeenCalled();
	});
	it('keeps swatch selection local on Cancel, then applies parent/child and clears back to inheritance', async () => {
		const { workflow, store, storage } = await fixture();
		workflow.openAssignment('Projects');
		requireElement<HTMLButtonElement>(
			document,
			'[aria-label="Purple"]',
		).click();
		expect(
			document
				.querySelector('[aria-label="Purple"]')
				?.getAttribute('aria-pressed'),
		).toBe('true');
		button('Cancel').click();
		expect(storage.saveData).not.toHaveBeenCalled();
		workflow.openAssignment('Projects');
		requireElement<HTMLButtonElement>(
			document,
			'[aria-label="Purple"]',
		).click();
		button('Apply').click();
		await store.flush();
		await workflow.assign('Projects/Empty', 'blue');
		expect(
			store.resolve({ path: 'Projects/Empty/Note.md', kind: 'file' })
				?.color.id,
		).toBe('blue');
		workflow.openAssignment('Projects/Empty');
		button('Use inherited color').click();
		await store.flush();
		expect(
			store.resolve({ path: 'Projects/Empty/Note.md', kind: 'file' })
				?.color.id,
		).toBe('purple');
		expect(store.settings.assignments).toEqual({ Projects: 'purple' });
	});
	it('explains referenced deletion, supports cancellation, and resumes inheritance when confirmed', async () => {
		const { workflow, store, storage } = await fixture(
			assignFolder(
				assignFolder(defaultSettings(), 'Projects', 'purple'),
				'Projects/Empty',
				'blue',
			),
		);
		workflow.removeColor('blue');
		expect(document.body.textContent).toContain(
			'1 explicit folder assignment',
		);
		expect(document.body.textContent).toContain(
			'nearest remaining colored ancestor',
		);
		button('Cancel').click();
		expect(storage.saveData).not.toHaveBeenCalled();
		workflow.removeColor('blue');
		button('Remove color').click();
		await store.flush();
		expect(
			store.settings.palette.some((color) => color.id === 'blue'),
		).toBe(false);
		expect(
			store.resolve({ path: 'Projects/Empty/Note.md', kind: 'file' })
				?.color.id,
		).toBe('purple');
	});
	it('rejects deletion if an external edit introduces an unreviewed reference', async () => {
		const { workflow, store, storage } = await fixture(
			assignFolder(defaultSettings(), 'Projects', 'blue'),
		);
		workflow.removeColor('blue');
		storage.data = assignFolder(store.settings, 'Archive', 'blue');
		button('Remove color').click();
		await store.flush();
		expect(document.body.textContent).toContain('review the removal again');
		expect(
			document.querySelector('.cfft-error')?.textContent,
		).not.toContain('Retry saving');
		expect(store.hasUnsavedChanges).toBe(false);
		expect(store.settings.assignments).toEqual({
			Projects: 'blue',
			Archive: 'blue',
		});
		expect(storage.saveData).not.toHaveBeenCalled();
		expect(storage.data).toEqual(store.settings);
	});
	it('preserves independent appearance preferences and closes nested controls on unload', async () => {
		const { workflow, store } = await fixture();
		await store.setColoring('tabs', false);
		await store.setColoring('icons', false);
		expect(store.settings.coloring).toEqual({
			text: false,
			icons: false,
			tabs: false,
		});
		workflow.managePalette();
		button('Add color').click();
		expect(document.querySelectorAll('.cfft-modal')).toHaveLength(2);
		workflow.dispose();
		expect(document.querySelectorAll('.cfft-modal')).toHaveLength(0);
	});
});
