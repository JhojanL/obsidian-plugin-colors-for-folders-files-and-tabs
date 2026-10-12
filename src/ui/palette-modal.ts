import { Setting } from 'obsidian';
import { ColorModal } from './modal';
import { PalettePanel } from './palette-panel';

/** Manage the same palette panel from the command palette without opening settings. */
export class PaletteModal extends ColorModal {
	onOpen(): void {
		super.onOpen();
		this.setTitle('Manage palette');
		this.lifetime.addChild(new PalettePanel(this.contentEl, this.workflow));
		new Setting(this.contentEl)
			.setClass('cfft-dialog-actions')
			.addButton((button) =>
				button.setButtonText('Done').onClick(() => this.close()),
			);
		this.contentEl.querySelector<HTMLButtonElement>('button')?.focus();
	}
}
