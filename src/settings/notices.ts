import { Notice } from 'obsidian';
import type { SettingsStore } from './store';

/** Reload store and explain actual read-only failures without replacing the original saved data. */
export async function reloadSettings(store: SettingsStore): Promise<void> {
	await store.reload();
	if (!store.writable) {
		new Notice(
			store.status === 'future'
				? 'Color settings were saved by a newer plugin version. Update the plugin before editing colors.'
				: 'Color settings could not be loaded. Saved data was kept; recover it before editing colors.',
		);
	}
}

/** Describe error from an edit or write; store determines whether a snapshot is actually available to retry. */
export function settingsErrorMessage(
	error: unknown,
	store: SettingsStore,
): string {
	const detail = error instanceof Error ? ` ${error.message}` : '';
	const recovery = store.hasUnsavedChanges
		? ' Unsaved changes are kept. Try the action again, or select Retry saving in settings to save them.'
		: '';
	return `Could not update colors.${detail}${recovery}`;
}

/** Report error using store's current persistence state; rejected drafts are not claimed as retained settings. */
export function reportSettingsError(
	error: unknown,
	store: SettingsStore,
): void {
	new Notice(settingsErrorMessage(error, store));
}
