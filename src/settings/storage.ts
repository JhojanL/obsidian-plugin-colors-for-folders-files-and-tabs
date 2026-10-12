import type { DataAdapter, PluginManifest } from 'obsidian';
import type { SettingsStorage } from './store';

/** Host capabilities limited to this plugin's settings and file metadata. */
interface PluginSettingsHost extends SettingsStorage {
	readonly manifest: Pick<PluginManifest, 'dir'>;
	readonly app: {
		readonly vault: {
			readonly adapter: Pick<DataAdapter, 'stat'>;
		};
	};
}

/** Guard plugin's empty reads using only its own data.json metadata; retain native save/reload bookkeeping. */
export function createSettingsStorage(
	plugin: PluginSettingsHost,
): SettingsStorage {
	return {
		loadData: async () => {
			const data: unknown = await plugin.loadData();
			if (data === null || data === undefined) {
				// Obsidian also returns null for malformed JSON and swallowed read errors.
				const directory = plugin.manifest.dir;
				if (!directory)
					throw new Error(
						'The color settings directory is unavailable.',
					);
				const entry = await plugin.app.vault.adapter.stat(
					`${directory}/data.json`,
				);
				if (entry !== null)
					throw new Error(
						'Existing color settings could not be loaded.',
					);
			}
			return data;
		},
		saveData: (settings) => plugin.saveData(settings),
	};
}
