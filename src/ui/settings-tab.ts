import {
	ButtonComponent,
	Component,
	PluginSettingTab,
	Setting,
	TFolder,
	type Plugin,
	type SettingDefinitionGroup,
	type SettingGroup,
} from 'obsidian';
import type { ColoringOptions } from '../model/types';
import { nativeToggleControl, syncNativeToggle } from '../adapters/toggle';
import type { ColorWorkflow } from '../settings/workflow';
import { ActionFeedback } from './feedback';
import { captureFocus } from './focus';
import { PalettePanel } from './palette-panel';

/** Declare searchable native settings, keeping custom rendering, saves, and subscriptions explicit. */
export class ColorSettingsTab extends PluginSettingTab {
	private lifetime: Component | null = null;
	private feedback: ActionFeedback | null = null;
	private readonly refreshers = new Set<() => void>();

	/** plugin registers the page; workflow shares every mutation and dialog with menus and commands. */
	constructor(
		plugin: Plugin,
		private readonly workflow: ColorWorkflow,
	) {
		super(plugin.app, plugin);
	}

	/** Return search definitions without I/O; render callbacks persist through SettingsStore's save/recovery contract. */
	getSettingDefinitions(): SettingDefinitionGroup[] {
		return [
			{
				type: 'group',
				heading: 'Palette',
				items: [
					{
						name: 'Palette',
						render: (setting, group) =>
							this.renderPalette(setting, group),
					},
				],
			},
			{
				type: 'group',
				heading: 'Folder assignments',
				items: [
					{
						name: 'Set folder color',
						desc: 'Folders without an assignment inherit their nearest colored ancestor.',
						render: (setting) => this.renderAssignments(setting),
					},
				],
			},
			{
				type: 'group',
				heading: 'Appearance',
				items: [
					...(
						[
							[
								'icons',
								'Color icons',
								'Color folder and file icons in the Explorer.',
							],
							[
								'text',
								'Color names',
								'Also color folder and file names in the Explorer.',
							],
							[
								'tabs',
								'Color tab icons',
								'Color file-type icons in file-backed tabs.',
							],
						] as const
					).map(([channel, name, desc]) => ({
						name,
						desc,
						render: (setting: Setting) =>
							this.renderToggle(setting, channel, name),
					})),
				],
			},
		];
	}

	/**
	 * Replace setting's content with palette controls, disposing the previous page lifetime first.
	 * group owns the native heading/list; its heading is cleared and a custom native header is inserted before the list.
	 */
	private renderPalette(setting: Setting, group: SettingGroup): void {
		this.hide();
		this.containerEl.addClass('cfft-controls', 'cfft-settings');
		const lifetime = (this.lifetime = new Component());
		this.lifetime.load();
		group.setHeading('');
		const header = new Setting(group.listEl)
			.setName('Palette')
			.setHeading()
			.setClass('cfft-palette-heading');
		group.listEl.before(header.settingEl);
		setting.settingEl.empty();
		setting.setClass('cfft-palette-content');
		const content = setting.settingEl;
		const store = this.workflow.store;
		const banner = content.createDiv({
			attr: { role: 'status', 'aria-atomic': 'true' },
		});
		const retry = new ButtonComponent(content)
			.setButtonText('Retry saving')
			.onClick(async () => {
				await this.feedback?.run(() => store.retrySave());
			});
		retry.buttonEl.dataset.cfftFocus = 'retry-saving';
		this.feedback = lifetime.addChild(
			new ActionFeedback(content, store, () => this.refresh()),
		);
		lifetime.addChild(
			new PalettePanel(content, this.workflow, {
				addButtonParent: header.controlEl,
			}),
		);
		this.watch(() => {
			const failed = store.hasUnsavedChanges && store.saveError !== null;
			banner.setText(
				!store.writable
					? 'Saved color settings could not be loaded. Recover the saved data or update the plugin before editing.'
					: failed
						? `Changes are visible but not saved. ${store.saveError} Select Retry saving.`
						: '',
			);
			banner.hidden = store.writable && !failed;
			retry.buttonEl.hidden = !failed;
			retry.setDisabled(!store.writable || !!this.feedback?.running);
		});
		lifetime.register(store.subscribe(() => this.refresh()));
	}

	/** Render explicit assignments inside setting; full paths distinguish folders with matching basenames. */
	private renderAssignments(setting: Setting): void {
		setting.settingEl.empty();
		setting.setClass('cfft-assignment-content');
		let assign: ButtonComponent;
		new Setting(setting.settingEl)
			.setName('Set folder color')
			.setDesc(
				'Folders without an assignment inherit their nearest colored ancestor.',
			)
			.addButton((button) => {
				assign = button
					.setButtonText('Set folder color…')
					.onClick(() => this.workflow.chooseFolder());
				button.buttonEl.dataset.cfftFocus = 'choose-folder';
			});
		const assignments = setting.settingEl.createDiv({
			cls: 'cfft-assignments',
		});
		const store = this.workflow.store;
		const inheritedActions: ButtonComponent[] = [];
		let renderedState = '';
		this.watch(() => {
			assign!.setDisabled(!store.writable);
			const disabled = !store.writable || !!this.feedback?.running;
			for (const action of inheritedActions) action.setDisabled(disabled);
			const entries = Object.entries(store.settings.assignments)
				.sort(([a], [b]) => a.localeCompare(b))
				.map(([path, id]) => {
					const color = store.settings.palette.find(
						(entry) => entry.id === id,
					);
					const exists =
						this.app.vault.getAbstractFileByPath(path) instanceof
						TFolder;
					return {
						path,
						name: color?.name ?? 'Unknown color',
						exists,
					};
				});
			const state = JSON.stringify([entries, store.writable]);
			// Persistence and switch changes must not replace rows or move focus.
			if (state === renderedState) return;
			renderedState = state;
			const focus = captureFocus(this.containerEl.ownerDocument);
			assignments.empty();
			inheritedActions.length = 0;
			if (!entries.length)
				new Setting(assignments).setDesc('No explicit assignments.');
			for (const { path, name, exists } of entries) {
				new Setting(assignments)
					.setName(path)
					.setDesc(`${name}${exists ? '' : ' · Folder missing'}`)
					.addButton((button) => {
						button
							.setButtonText('Change')
							.setDisabled(!exists || !store.writable)
							.onClick(() => this.workflow.openAssignment(path));
						button.buttonEl.setAttribute(
							'aria-label',
							`Change color for ${path}`,
						);
						button.buttonEl.dataset.cfftFocus = `assign-${path}`;
					})
					.addButton((button) => {
						button
							.setButtonText('Use inherited color')
							.setDisabled(disabled)
							.onClick(async () => {
								await this.feedback?.run(() =>
									this.workflow.assign(path, null),
								);
							});
						button.buttonEl.setAttribute(
							'aria-label',
							`Use inherited color for ${path}`,
						);
						button.buttonEl.dataset.cfftFocus = `inherit-${path}`;
						inheritedActions.push(button);
					});
			}
			focus.restore();
		});
	}

	/** Bind setting's native toggle to coloring channel, using name as its accessible label and saving through the store. */
	private renderToggle(
		setting: Setting,
		channel: keyof ColoringOptions,
		name: string,
	): void {
		setting.setClass('cfft-toggle-setting');
		setting.addToggle((toggle) => {
			let synchronizing = false;
			const target = setting.controlEl.createDiv({
				cls: 'cfft-toggle-target',
			});
			target.appendChild(toggle.toggleEl);
			this.lifetime?.registerDomEvent(target, 'click', (event) => {
				if (event.target === target) toggle.onClick();
			});
			// Native Settings tabs through both the row and switch. Capture Enter to activate once at either stop.
			this.lifetime?.registerDomEvent(
				setting.settingEl,
				'keydown',
				(event) => {
					if (
						event.key !== 'Enter' ||
						event.isComposing ||
						event.ctrlKey ||
						event.altKey ||
						event.metaKey ||
						event.shiftKey
					)
						return;
					event.preventDefault();
					event.stopImmediatePropagation();
					if (
						event.repeat ||
						!this.workflow.store.writable ||
						this.feedback?.running
					)
						return;
					nativeToggleControl(toggle).focus({ preventScroll: true });
					toggle.onClick();
				},
				{ capture: true },
			);
			toggle.onChange(async (value) => {
				if (synchronizing) return;
				await this.feedback?.run(() =>
					this.workflow.store.setColoring(channel, value),
				);
			});
			nativeToggleControl(toggle).dataset.cfftFocus =
				`coloring-${channel}`;
			this.watch(() => {
				// Native setValue calls onChange; rendering stored preferences must not enqueue another edit.
				synchronizing = true;
				try {
					syncNativeToggle(
						toggle,
						name,
						this.workflow.store.settings.coloring[channel],
						!this.workflow.store.writable ||
							!!this.feedback?.running,
					);
				} finally {
					synchronizing = false;
				}
			});
		});
	}

	/** Add refresh to this rendered page's lifetime and initialize its current state once. */
	private watch(refresh: () => void): void {
		this.refreshers.add(refresh);
		refresh();
	}

	/** Update the rendered custom controls after model or persistence changes. */
	private refresh(): void {
		for (const refresh of this.refreshers) refresh();
	}

	/** Release custom controls and store subscriptions whenever the host hides or unloads this page. */
	hide(): void {
		this.lifetime?.unload();
		this.lifetime = null;
		this.feedback = null;
		this.refreshers.clear();
	}
}
