import { TFolder, type Plugin } from 'obsidian';
import { reportSettingsError } from '../settings/notices';
import type { SettingsStore } from '../settings/store';

/** Follow plugin's metadata-only vault events in store; Obsidian unregisters them on unload. */
export function registerSettingsEvents(
	plugin: Plugin,
	store: SettingsStore,
): void {
	plugin.registerEvent(
		plugin.app.vault.on('rename', (file, oldPath) => {
			store.invalidate();
			if (file instanceof TFolder && store.writable) {
				void store
					.moveFolder(oldPath, file.path)
					.catch((error: unknown) =>
						reportSettingsError(error, store),
					);
			}
		}),
	);
	plugin.registerEvent(
		plugin.app.vault.on('delete', (file) => {
			store.invalidate();
			if (file instanceof TFolder && store.writable) {
				void store
					.deleteFolder(file.path)
					.catch((error: unknown) =>
						reportSettingsError(error, store),
					);
			}
		}),
	);
}
