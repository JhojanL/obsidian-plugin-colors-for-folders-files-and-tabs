import type { App, Plugin } from 'obsidian';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { assignFolder } from '../../src/model/changes';
import { defaultSettings } from '../../src/model/settings';
import { SettingsStore } from '../../src/settings/store';
import { ColorWorkflow } from '../../src/settings/workflow';
import { ColorSettingsTab } from '../../src/ui/settings-tab';
import { TFolder } from '../fixtures/obsidian';
import { MemorySettings, deferred } from '../fixtures/settings';
import { SettingGroup } from '../fixtures/ui-controls';
import { installObsidianDom, requireElement } from '../fixtures/dom-support';

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

/** Render native setting callbacks using stored data (null uses defaults); own teardown after each test. */
async function page(data: unknown = null) {
	const app = {
		workspace: { on: () => () => {} },
		vault: { getAbstractFileByPath: (path: string) => new TFolder(path) },
	} as unknown as App;
	const storage = new MemorySettings(data);
	const store = new SettingsStore(storage);
	await store.reload();
	const workflow = new ColorWorkflow(app, store);
	const tab = new ColorSettingsTab({ app } as Plugin, workflow);
	const definitions = tab.getSettingDefinitions();
	for (const definition of definitions) {
		const group = new SettingGroup(tab.containerEl).setHeading(
			definition.heading ?? '',
		);
		const rows: HTMLElement[] = [];
		for (const item of definition.items ?? []) {
			if (!('render' in item) || typeof item.render !== 'function')
				throw new Error(
					'This fixture requires custom-rendered settings.',
				);
			const render = item.render;
			group.addSetting((setting) => {
				setting.setName(item.name).setDesc(item.desc ?? '');
				render(setting, group);
				rows.push(setting.settingEl);
			});
		}
		group.listEl.replaceChildren(...rows);
	}
	cleanups.push(() => {
		tab.hide();
		workflow.dispose();
		store.dispose();
	});
	return { tab, store, storage, definitions, workflow };
}

/** Require a native button with visible name inside root before invoking its action. */
function button(root: ParentNode, name: string): HTMLButtonElement {
	const found = Array.from(
		root.querySelectorAll<HTMLButtonElement>('button'),
	).find((candidate) => candidate.textContent === name);
	if (!found) throw new Error(`Missing button: ${name}`);
	return found;
}

describe('native settings state and recovery', () => {
	it('keeps search definitions free of settings I/O and rendered-page changes', async () => {
		const { tab, storage, workflow } = await page();
		storage.loadData.mockClear();
		const lookup = vi.spyOn(workflow.app.vault, 'getAbstractFileByPath');
		const before = tab.containerEl.innerHTML;
		const definitions = tab.getSettingDefinitions();
		expect(definitions.flatMap((group) => group.items ?? [])).toHaveLength(
			5,
		);
		expect(storage.loadData).not.toHaveBeenCalled();
		expect(storage.saveData).not.toHaveBeenCalled();
		expect(lookup).not.toHaveBeenCalled();
		expect(tab.containerEl.innerHTML).toBe(before);
	});
	it('renders and reloads appearance preferences without treating synchronization as an edit', async () => {
		const { tab, store, storage } = await page(defaultSettings());
		await store.flush();
		expect(storage.loadData).toHaveBeenCalledTimes(1);
		expect(storage.saveData).not.toHaveBeenCalled();
		storage.data = {
			...defaultSettings(),
			coloring: { icons: false, text: true, tabs: false },
		};
		await store.reload();
		await store.flush();
		expect(storage.loadData).toHaveBeenCalledTimes(2);
		expect(storage.saveData).not.toHaveBeenCalled();
		for (const [name, checked] of [
			['Color icons', false],
			['Color names', true],
			['Color tab icons', false],
		] as const) {
			const input = requireElement<HTMLInputElement>(
				tab.containerEl,
				`input[aria-label="${name}"]`,
			);
			expect(input.checked).toBe(checked);
			expect(input.disabled).toBe(false);
		}
	});
	it.each(['Color icons', 'Color names', 'Color tab icons'])(
		'places %s keyboard focus on the native checkbox',
		async (name) => {
			const { tab } = await page();
			const input = requireElement<HTMLInputElement>(
				tab.containerEl,
				`input[aria-label="${name}"]`,
			);
			expect(input.tabIndex).toBe(0);
			expect(input.parentElement?.tabIndex).toBe(-1);
			input.focus();
			expect(document.activeElement).toBe(input);
		},
	);
	it.each([
		['Color icons', 'icons', false],
		['Color names', 'text', true],
		['Color tab icons', 'tabs', false],
	] as const)(
		'saves %s without replacing settings rows, showing progress, or moving focus',
		async (name, channel, enabled) => {
			const initial = assignFolder(
				defaultSettings(),
				'Projects',
				'purple',
			);
			const { tab, store, storage } = await page(initial);
			const input = requireElement<HTMLInputElement>(
				tab.containerEl,
				`input[aria-label="${name}"]`,
			);
			const assignment = requireElement<HTMLButtonElement>(
				tab.containerEl,
				'[aria-label="Change color for Projects"]',
			);
			const inherit = requireElement<HTMLButtonElement>(
				tab.containerEl,
				'[aria-label="Use inherited color for Projects"]',
			);
			const palette = requireElement<HTMLButtonElement>(
				tab.containerEl,
				'[aria-label="Purple"]',
			);
			const retry = requireElement<HTMLButtonElement>(
				tab.containerEl,
				'[data-cfft-focus="retry-saving"]',
			);
			const started = deferred<void>();
			const finish = deferred<void>();
			storage.saveData.mockImplementationOnce(async (settings) => {
				started.resolve();
				await finish.promise;
				storage.data = settings;
			});
			input.focus();
			input.click();
			await started.promise;
			try {
				expect(
					tab.containerEl.querySelector(
						'[aria-label="Change color for Projects"]',
					),
				).toBe(assignment);
				expect(inherit.disabled).toBe(true);
				expect(palette.isConnected).toBe(true);
				expect(document.activeElement).toBe(input);
				expect(retry.hidden).toBe(true);
				expect(tab.containerEl.textContent).not.toContain(
					'Saving colors',
				);
			} finally {
				finish.resolve();
				await store.flush();
				await Promise.resolve();
			}
			expect(assignment.isConnected).toBe(true);
			expect(inherit.disabled).toBe(false);
			expect(document.activeElement).toBe(input);
			expect(input.checked).toBe(enabled);
			const restarted = new SettingsStore(storage);
			await restarted.reload();
			expect(restarted.settings.coloring).toEqual({
				...initial.coloring,
				[channel]: enabled,
			});
			expect(restarted.settings.assignments).toEqual(initial.assignments);
		},
	);
	it.each(['icons', 'text', 'tabs'] as const)(
		'toggles %s once per Enter press from either the row or switch, retaining assignment rows',
		async (channel) => {
			const initial = assignFolder(
				defaultSettings(),
				'Projects',
				'purple',
			);
			const { tab, store, storage } = await page(initial);
			const input = requireElement<HTMLInputElement>(
				tab.containerEl,
				`[data-cfft-focus="coloring-${channel}"]`,
			);
			const toggle = input.parentElement!;
			const assignments = requireElement(
				tab.containerEl,
				'.cfft-assignments',
			);
			const assignment = assignments.firstElementChild;
			const row = toggle.closest<HTMLElement>('.setting-item')!;
			for (const target of [row, input]) {
				for (const enabled of [
					!initial.coloring[channel],
					initial.coloring[channel],
				]) {
					target.focus();
					const event = new KeyboardEvent('keydown', {
						key: 'Enter',
						bubbles: true,
						cancelable: true,
					});
					target.dispatchEvent(event);
					await store.flush();
					await Promise.resolve();
					expect(store.settings.coloring[channel]).toBe(enabled);
					expect(input.checked).toBe(enabled);
					expect(toggle.classList.contains('is-enabled')).toBe(
						enabled,
					);
					expect(document.activeElement).toBe(input);
					expect(assignments.firstElementChild).toBe(assignment);
					expect(event.defaultPrevented).toBe(true);
				}
			}
			expect(storage.saveData).toHaveBeenCalledTimes(4);
			expect(store.settings.assignments).toEqual(initial.assignments);
		},
	);
	it.each(['icons', 'text', 'tabs'] as const)(
		'saves %s through native Space and accessibility change activation',
		async (channel) => {
			const initial = defaultSettings();
			const { tab, store, storage } = await page(initial);
			const input = requireElement<HTMLInputElement>(
				tab.containerEl,
				`[data-cfft-focus="coloring-${channel}"]`,
			);
			for (const activation of ['space', 'change']) {
				const enabled = !store.settings.coloring[channel];
				input.focus();
				if (activation === 'space') {
					input.dispatchEvent(
						new KeyboardEvent('keydown', {
							key: ' ',
							bubbles: true,
							cancelable: true,
						}),
					);
				} else {
					// Accessibility activation may report a checkbox change without a keydown event.
					input.checked = enabled;
					input.dispatchEvent(new Event('change', { bubbles: true }));
				}
				await store.flush();
				await Promise.resolve();
				expect(store.settings.coloring).toEqual({
					...initial.coloring,
					[channel]: enabled,
				});
				expect(input.checked).toBe(enabled);
				expect(
					input.parentElement?.classList.contains('is-enabled'),
				).toBe(enabled);
				expect(document.activeElement).toBe(input);
			}
			expect(storage.saveData).toHaveBeenCalledTimes(2);
			expect(store.settings.coloring).toEqual(initial.coloring);
		},
	);
	it('ignores held Enter, preserves other key handlers, and releases its keyboard handler on hide', async () => {
		const { tab, store, storage } = await page();
		const toggle = requireElement<HTMLElement>(
			tab.containerEl,
			'[data-cfft-focus="coloring-icons"]',
		);
		const row = toggle.closest<HTMLElement>('.setting-item')!;
		const nativeKey = vi.fn();
		row.addEventListener('keydown', nativeKey);
		for (const init of [
			{ key: ' ' },
			{ key: 'Tab' },
			{ key: 'Escape' },
			{ key: 'Enter', ctrlKey: true },
			{ key: 'Enter', altKey: true },
			{ key: 'Enter', metaKey: true },
			{ key: 'Enter', shiftKey: true },
			{ key: 'Enter', isComposing: true },
		]) {
			const event = new KeyboardEvent('keydown', {
				...init,
				bubbles: true,
				cancelable: true,
			});
			row.dispatchEvent(event);
			expect(event.defaultPrevented).toBe(false);
		}
		expect(nativeKey).toHaveBeenCalledTimes(8);
		row.focus();
		const held = new KeyboardEvent('keydown', {
			key: 'Enter',
			repeat: true,
			bubbles: true,
			cancelable: true,
		});
		row.dispatchEvent(held);
		await store.flush();
		expect(held.defaultPrevented).toBe(true);
		expect(storage.saveData).not.toHaveBeenCalled();
		expect(document.activeElement).toBe(row);
		tab.hide();
		const released = new KeyboardEvent('keydown', {
			key: 'Enter',
			bubbles: true,
			cancelable: true,
		});
		row.dispatchEvent(released);
		await store.flush();
		expect(released.defaultPrevented).toBe(false);
		expect(document.activeElement).toBe(row);
		expect(storage.saveData).not.toHaveBeenCalled();
	});
	it('blocks Enter on every appearance control during a save and permits it again afterwards', async () => {
		const { tab, store, storage } = await page();
		const toggles = Array.from(
			tab.containerEl.querySelectorAll<HTMLElement>(
				'.checkbox-container',
			),
		);
		const started = deferred<void>();
		const finish = deferred<void>();
		storage.saveData.mockImplementationOnce(async (settings) => {
			started.resolve();
			await finish.promise;
			storage.data = settings;
		});
		toggles[0]!.dispatchEvent(
			new KeyboardEvent('keydown', {
				key: 'Enter',
				bubbles: true,
				cancelable: true,
			}),
		);
		await started.promise;
		try {
			for (const toggle of toggles) {
				for (const target of [
					toggle.closest<HTMLElement>('.setting-item')!,
					toggle,
				]) {
					target.dispatchEvent(
						new KeyboardEvent('keydown', {
							key: 'Enter',
							bubbles: true,
							cancelable: true,
						}),
					);
				}
			}
			expect(store.settings.coloring).toEqual({
				text: false,
				icons: false,
				tabs: true,
			});
			expect(storage.saveData).toHaveBeenCalledTimes(1);
		} finally {
			finish.resolve();
			await store.flush();
			await Promise.resolve();
		}
		toggles[1]!.dispatchEvent(
			new KeyboardEvent('keydown', {
				key: 'Enter',
				bubbles: true,
				cancelable: true,
			}),
		);
		await store.flush();
		expect(store.settings.coloring.text).toBe(true);
		expect(storage.saveData).toHaveBeenCalledTimes(2);
	});
	it('keeps protected settings unchanged when Enter targets an appearance row or switch', async () => {
		const { tab, store, storage } = await page({ schemaVersion: 999 });
		for (const toggle of tab.containerEl.querySelectorAll<HTMLElement>(
			'.checkbox-container',
		)) {
			for (const target of [
				toggle.closest<HTMLElement>('.setting-item')!,
				toggle,
			]) {
				target.dispatchEvent(
					new KeyboardEvent('keydown', {
						key: 'Enter',
						bubbles: true,
						cancelable: true,
					}),
				);
			}
		}
		await store.flush();
		expect(store.writable).toBe(false);
		expect(storage.saveData).not.toHaveBeenCalled();
		expect(storage.data).toEqual({ schemaVersion: 999 });
	});
	it.each(['success', 'failure', 'failure without a message'])(
		'disables shared appearance controls during a pending save and recovers after %s',
		async (outcome) => {
			const { tab, store, storage } = await page();
			const icons = requireElement<HTMLInputElement>(
				tab.containerEl,
				'input[aria-label="Color icons"]',
			);
			const names = requireElement<HTMLInputElement>(
				tab.containerEl,
				'input[aria-label="Color names"]',
			);
			const tabs = requireElement<HTMLInputElement>(
				tab.containerEl,
				'input[aria-label="Color tab icons"]',
			);
			const started = deferred<void>();
			const finish = deferred<void>();
			storage.saveData.mockImplementationOnce(async (settings) => {
				started.resolve();
				await finish.promise;
				if (outcome !== 'success')
					throw new Error(
						outcome === 'failure' ? 'Disk unavailable' : '',
					);
				storage.data = settings;
			});
			icons.click();
			await started.promise;
			try {
				expect([icons.disabled, names.disabled, tabs.disabled]).toEqual(
					[true, true, true],
				);
				names.click();
				expect(store.settings.coloring.text).toBe(false);
			} finally {
				finish.resolve();
				await store.flush();
				await Promise.resolve();
			}
			expect([icons.disabled, names.disabled, tabs.disabled]).toEqual([
				false,
				false,
				false,
			]);
			if (outcome !== 'success') {
				expect(store.hasUnsavedChanges).toBe(true);
				expect(storage.data).toBeNull();
				const retry = requireElement<HTMLButtonElement>(
					tab.containerEl,
					'[data-cfft-focus="retry-saving"]',
				);
				expect(retry.hidden).toBe(false);
				retry.click();
				await store.flush();
				await Promise.resolve();
			}
			names.click();
			await store.flush();
			const restarted = new SettingsStore(storage);
			await restarted.reload();
			expect(restarted.settings.coloring).toEqual({
				icons: false,
				text: true,
				tabs: true,
			});
			expect(store.hasUnsavedChanges).toBe(false);
		},
	);
	it('retains the header Add action and native assignment rows after the host installs rendered content', async () => {
		const { tab, store } = await page(
			assignFolder(defaultSettings(), 'Projects', 'purple'),
		);
		const add = requireElement<HTMLButtonElement>(
			tab.containerEl,
			'[data-cfft-focus="add-color"]',
		);
		expect(add.closest('.setting-item-heading')).not.toBeNull();
		add.focus();
		add.click();
		expect(
			document.querySelector<HTMLInputElement>(
				'[aria-label="Color name"]',
			)?.value,
		).toBe('');
		button(document, 'Cancel').click();
		await Promise.resolve();
		expect(document.activeElement).toBe(add);
		const assign = requireElement(
			tab.containerEl,
			'[data-cfft-focus="choose-folder"]',
		);
		expect(
			assign.closest('.setting-item')?.querySelector('.setting-item-name')
				?.textContent,
		).toBe('Set folder color');
		expect(
			tab.containerEl.querySelector(
				'[aria-label="Change color for Projects"]',
			),
		).not.toBeNull();
		await store.setAssignment('Archive', 'red');
		expect(
			tab.containerEl.querySelector(
				'[aria-label="Change color for Archive"]',
			),
		).not.toBeNull();
	});
	it('keeps the native checkbox checked state aligned with the visual and persisted preference', async () => {
		const { tab, store } = await page();
		const input = requireElement<HTMLInputElement>(
			tab.containerEl,
			'input[data-cfft-focus="coloring-text"]',
		);
		expect(input.checked).toBe(false);
		expect(input.getAttribute('aria-label')).toBe('Color names');
		await store.setColoring('text', true);
		expect(input.checked).toBe(true);
		const target = requireElement(
			tab.containerEl,
			'.cfft-toggle-target:has([data-cfft-focus="coloring-text"])',
		);
		target.dispatchEvent(new MouseEvent('click', { bubbles: true }));
		await store.flush();
		expect(store.settings.coloring.text).toBe(false);
		expect(input.checked).toBe(false);
		tab.hide();
		target.dispatchEvent(new MouseEvent('click', { bubbles: true }));
		await store.flush();
		expect(store.settings.coloring.text).toBe(false);
	});
	it('updates assignment names, missing-folder actions, and cleared assignments when their data changes', async () => {
		const { tab, store, workflow } = await page(
			assignFolder(defaultSettings(), 'Projects', 'purple'),
		);
		const purple = store.settings.palette.find(
			(color) => color.id === 'purple',
		);
		if (!purple) throw new Error('Missing fixture palette color');
		await store.putColor({ ...purple, name: 'Plum' });
		const assignments = requireElement(
			tab.containerEl,
			'.cfft-assignments',
		);
		expect(
			assignments.querySelector('.setting-item-description')?.textContent,
		).toBe('Plum');
		vi.spyOn(workflow.app.vault, 'getAbstractFileByPath').mockReturnValue(
			null,
		);
		store.invalidate();
		expect(
			assignments.querySelector('.setting-item-description')?.textContent,
		).toBe('Plum · Folder missing');
		expect(
			requireElement<HTMLButtonElement>(
				assignments,
				'[aria-label="Change color for Projects"]',
			).disabled,
		).toBe(true);
		expect(
			requireElement<HTMLButtonElement>(
				assignments,
				'[aria-label="Use inherited color for Projects"]',
			).disabled,
		).toBe(false);
		await store.setAssignment('Projects', null);
		expect(assignments.textContent).toBe('No explicit assignments.');
	});
	it('exposes searchable names without auto-saving, and retries a failed appearance edit from the page', async () => {
		const { tab, store, storage, definitions } = await page();
		expect(definitions.map((definition) => definition.heading)).toEqual([
			'Palette',
			'Folder assignments',
			'Appearance',
		]);
		expect(
			definitions.flatMap((group) =>
				(group.items ?? []).map((item) => item.name),
			),
		).toEqual([
			'Palette',
			'Set folder color',
			'Color icons',
			'Color names',
			'Color tab icons',
		]);
		expect(storage.saveData).not.toHaveBeenCalled();
		const retry = requireElement<HTMLButtonElement>(
			tab.containerEl,
			'[data-cfft-focus="retry-saving"]',
		);
		expect(retry.hidden).toBe(true);
		storage.saveData.mockRejectedValueOnce(new Error('Disk unavailable'));
		requireElement<HTMLInputElement>(
			tab.containerEl,
			'input[aria-label="Color icons"]',
		).click();
		await store.flush();
		expect(store.settings.coloring.icons).toBe(false);
		expect(store.hasUnsavedChanges).toBe(true);
		expect(tab.containerEl.textContent).toContain(
			'Changes are visible but not saved',
		);
		expect(retry.hidden).toBe(false);
		retry.click();
		await store.flush();
		expect(store.hasUnsavedChanges).toBe(false);
		expect(retry.hidden).toBe(true);
		const restarted = new SettingsStore(storage);
		await restarted.reload();
		expect(restarted.settings.coloring.icons).toBe(false);
	});
	it('disables mutation controls for unsupported saved settings and releases view subscriptions when hidden', async () => {
		const { tab, storage, store } = await page({
			schemaVersion: 999,
			untouched: true,
		});
		expect(tab.containerEl.textContent).toContain('Recover the saved data');
		const controls = Array.from(
			tab.containerEl.querySelectorAll<
				HTMLInputElement | HTMLButtonElement
			>('button, input'),
		);
		for (const selector of [
			'[data-cfft-focus="add-color"]',
			'[data-cfft-focus="retry-saving"]',
			'[data-cfft-focus="choose-folder"]',
			'[aria-label="Edit Red"]',
			'[aria-label="Delete Red"]',
			'input[aria-label="Color icons"]',
			'input[aria-label="Color names"]',
			'input[aria-label="Color tab icons"]',
		])
			expect(
				requireElement<HTMLInputElement | HTMLButtonElement>(
					tab.containerEl,
					selector,
				).disabled,
			).toBe(true);
		expect(controls.every((control) => control.disabled)).toBe(true);
		expect(storage.saveData).not.toHaveBeenCalled();
		tab.hide();
		const before = tab.containerEl.innerHTML;
		storage.data = null;
		await store.reload();
		expect(tab.containerEl.innerHTML).toBe(before);
	});
});

describe('palette row actions', () => {
	it('selects through the swatch/name without opening an editor or saving, and exposes a non-color selected state', async () => {
		const { tab, storage, workflow } = await page();
		const edit = vi.spyOn(workflow, 'editColor');
		const red = requireElement<HTMLButtonElement>(
			tab.containerEl,
			'[aria-label="Red"]',
		);
		red.closest<HTMLElement>('.cfft-palette-row')!.click();
		expect(edit).not.toHaveBeenCalled();
		expect(red.getAttribute('aria-pressed')).toBe('false');
		red.focus();
		red.querySelector<HTMLElement>('.cfft-swatch')!.click();
		const chosen = requireElement<HTMLButtonElement>(
			tab.containerEl,
			'[aria-label="Red"]',
		);
		expect(chosen.getAttribute('aria-pressed')).toBe('true');
		expect(chosen.textContent).toBe('Red');
		expect(chosen.querySelector('.cfft-selected-mark')).toBeNull();
		expect(chosen.closest('.is-selected')).not.toBeNull();
		expect(document.activeElement).toBe(chosen);
		const status = requireElement(
			tab.containerEl,
			'.cfft-selection-status',
		);
		expect(status.textContent).toBe('Red selected.');
		expect(status.classList.contains('cfft-visually-hidden')).toBe(true);
		expect(status.getAttribute('role')).toBe('status');
		expect(status.getAttribute('aria-atomic')).toBe('true');
		expect(status.getAttribute('aria-hidden')).toBeNull();
		expect(tab.containerEl.querySelector('button button')).toBeNull();
		expect(edit).not.toHaveBeenCalled();
		expect(storage.saveData).not.toHaveBeenCalled();
	});
	it('edits its own color without changing selection and restores the initiating action across a renamed row', async () => {
		const { tab, store } = await page();
		requireElement<HTMLButtonElement>(
			tab.containerEl,
			'[aria-label="Red"]',
		).click();
		const edit = requireElement<HTMLButtonElement>(
			tab.containerEl,
			'[aria-label="Edit Orange"]',
		);
		edit.focus();
		edit.click();
		const name = requireElement<HTMLInputElement>(
			document,
			'[aria-label="Color name"]',
		);
		expect(name.value).toBe('Orange');
		name.value = 'Renamed orange';
		name.dispatchEvent(new Event('input', { bubbles: true }));
		button(document, 'Apply').click();
		await store.flush();
		await Promise.resolve();
		expect(
			tab.containerEl
				.querySelector('[aria-label="Red"]')
				?.getAttribute('aria-pressed'),
		).toBe('true');
		expect(document.activeElement?.getAttribute('aria-label')).toBe(
			'Edit Renamed orange',
		);
		expect(
			tab.containerEl.querySelector(
				'[aria-label="Delete Renamed orange"]',
			),
		).not.toBeNull();
	});
	it('keeps referenced deletion confirmation and cancel focus, then clears selection safely when confirmed', async () => {
		const { tab, store, storage } = await page(
			assignFolder(defaultSettings(), 'Projects', 'red'),
		);
		requireElement<HTMLButtonElement>(
			tab.containerEl,
			'[aria-label="Red"]',
		).click();
		const remove = requireElement<HTMLButtonElement>(
			tab.containerEl,
			'[aria-label="Delete Red"]',
		);
		remove.focus();
		remove.click();
		expect(document.querySelector('.cfft-modal')?.textContent).toContain(
			'1 explicit folder assignment',
		);
		button(document, 'Cancel').click();
		await Promise.resolve();
		expect(document.activeElement).toBe(remove);
		expect(storage.saveData).not.toHaveBeenCalled();
		remove.click();
		button(document, 'Remove color').click();
		await store.flush();
		await Promise.resolve();
		expect(store.settings.assignments).toEqual({});
		expect(tab.containerEl.querySelector('[aria-label="Red"]')).toBeNull();
		expect(
			tab.containerEl.querySelector('.cfft-selection-status')
				?.textContent,
		).toBe('Select a color.');
		expect(document.activeElement?.getAttribute('data-cfft-focus')).toBe(
			'add-color',
		);
	});
});

describe('shared palette selection', () => {
	it('keeps assignment save failures visible while selection summaries are visually hidden', async () => {
		const { workflow, store, storage } = await page();
		workflow.openAssignment('Projects');
		const modal = requireElement(document, '.cfft-modal');
		requireElement<HTMLButtonElement>(
			modal,
			'[aria-label="Purple"]',
		).click();
		storage.saveData.mockRejectedValueOnce(new Error('Disk unavailable.'));
		button(modal, 'Apply').click();
		await store.flush();
		await Promise.resolve();
		const warning = requireElement<HTMLElement>(
			modal,
			'.cfft-unsaved-status',
		);
		expect(warning.textContent).toBe('Changes are not saved yet.');
		expect(warning.hidden).toBe(false);
		expect(warning.classList.contains('cfft-visually-hidden')).toBe(false);
		const error = requireElement(modal, '.cfft-error');
		expect(error.textContent).toContain('Disk unavailable.');
		expect(error.textContent).toContain('Try the action again');
		expect(error.getAttribute('role')).toBe('alert');
		expect(error.classList.contains('cfft-visually-hidden')).toBe(false);
		expect(modal.isConnected).toBe(true);
		button(modal, 'Apply').click();
		await store.flush();
		expect(store.hasUnsavedChanges).toBe(false);
		expect(modal.isConnected).toBe(false);
	});
	it.each([
		{
			surface: 'Manage palette',
			path: null,
			initial: null,
			summary: null,
		},
		{
			surface: 'explicit assignment',
			path: 'Projects',
			initial: 'Purple',
			summary: 'Assigned Purple.',
		},
		{
			surface: 'inherited assignment',
			path: 'Projects/Empty',
			initial: 'Purple',
			summary: 'Inherits Purple from Projects.',
		},
		{
			surface: 'neutral assignment',
			path: 'Archive',
			initial: null,
			summary: 'No colored ancestor. This folder is neutral.',
		},
	])(
		'keeps $surface selection semantic and announcements visually hidden',
		async ({ path, initial, summary }) => {
			const { workflow, storage } = await page(
				assignFolder(defaultSettings(), 'Projects', 'purple'),
			);
			if (path) workflow.openAssignment(path);
			else workflow.managePalette();
			const modal = requireElement(document, '.cfft-modal');
			expect(
				modal
					.querySelector('[aria-pressed="true"]')
					?.getAttribute('aria-label') ?? null,
			).toBe(initial);
			if (summary) {
				const status = requireElement(modal, '.cfft-assignment-status');
				expect(status.textContent).toBe(summary);
				expect(status.classList.contains('cfft-visually-hidden')).toBe(
					true,
				);
				expect(status.getAttribute('role')).toBe('status');
				expect(status.getAttribute('aria-hidden')).toBeNull();
			}
			const orange = requireElement<HTMLButtonElement>(
				modal,
				'[aria-label="Orange"]',
			);
			orange.focus();
			orange.click();
			const chosen = requireElement(modal, '[aria-pressed="true"]');
			expect(
				modal.querySelectorAll('[aria-pressed="true"]'),
			).toHaveLength(1);
			expect(chosen.textContent).toBe('Orange');
			expect(chosen.closest('.is-selected')).not.toBeNull();
			expect(document.activeElement).toBe(chosen);
			const status = requireElement(modal, '.cfft-selection-status');
			expect(status.textContent).toBe('Orange selected.');
			expect(status.classList.contains('cfft-visually-hidden')).toBe(
				true,
			);
			expect(status.getAttribute('role')).toBe('status');
			expect(storage.saveData).not.toHaveBeenCalled();
		},
	);
});
