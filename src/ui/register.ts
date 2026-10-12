import { TFolder, type Plugin } from 'obsidian';
import { ColorWorkflow } from '../settings/workflow';
import type { SettingsStore } from '../settings/store';
import { ColorSettingsTab } from './settings-tab';

/** Register plugin's native page, stable no-hotkey commands, and folder-only menus through store. */
export function registerColorControls(
	plugin: Plugin,
	store: SettingsStore,
): void {
	const workflow = new ColorWorkflow(plugin.app, store);
	const tab = new ColorSettingsTab(plugin, workflow);
	plugin.addSettingTab(tab);
	plugin.register(() => {
		tab.hide();
		workflow.dispose();
	});
	plugin.addCommand({
		id: 'set-folder-color',
		name: 'Set folder color…',
		callback: () => workflow.chooseFolder(),
	});
	plugin.addCommand({
		id: 'manage-palette',
		name: 'Manage palette',
		callback: () => workflow.managePalette(),
	});
	plugin.registerEvent(
		plugin.app.workspace.on('file-menu', (menu, file) => {
			if (
				!(file instanceof TFolder) ||
				file.path === '/' ||
				file.path === ''
			)
				return;
			menu.addItem((item) =>
				item
					.setTitle('Set folder color…')
					.setIcon('palette')
					.setDisabled(!store.writable)
					.onClick(() => workflow.openAssignment(file.path)),
			);
			menu.addItem((item) =>
				item
					.setTitle('Use inherited color')
					.setIcon('undo-2')
					.setDisabled(
						!store.writable ||
							!Object.prototype.hasOwnProperty.call(
								store.settings.assignments,
								file.path,
							),
					)
					.onClick(async () => {
						await workflow.clearFromMenu(file.path);
					}),
			);
		}),
	);
}
