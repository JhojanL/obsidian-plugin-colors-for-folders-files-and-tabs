import { Plugin } from 'obsidian';
import { registerHostIntegration } from './adapters/register';
import { registerSettingsEvents } from './adapters/settings-events';
import { reloadSettings } from './settings/notices';
import { createSettingsStorage } from './settings/storage';
import { SettingsStore } from './settings/store';
import { registerColorControls } from './ui/register';

/** Load the local color model and register host adapters with Obsidian-owned cleanup. */
export default class ColorsPlugin extends Plugin {
	settings!: SettingsStore;

	async onload(): Promise<void> {
		this.settings = new SettingsStore(createSettingsStorage(this));
		this.register(() => this.settings.dispose());
		await reloadSettings(this.settings);
		if (this.settings.isDisposed) return;
		registerColorControls(this, this.settings);
		registerSettingsEvents(this, this.settings);
		const refresh = registerHostIntegration(
			this,
			this.settings.resolve,
			() => this.settings.settings.coloring,
		);
		this.register(this.settings.subscribe(refresh));
	}

	async onExternalSettingsChange(): Promise<void> {
		if (this.settings) await reloadSettings(this.settings);
	}
}
