import { Setting, type ButtonComponent } from 'obsidian';
import type { PaletteColor } from '../model/types';
import type { ColorWorkflow } from '../settings/workflow';
import { ActionFeedback } from './feedback';
import { ColorModal } from './modal';

/** Confirm removal with explicit references and the resulting ancestor inheritance or neutral state. */
export class RemoveColorModal extends ColorModal {
	/** workflow owns mutations; color identifies the reviewed entry; references lists the reviewed assignments. */
	constructor(
		workflow: ColorWorkflow,
		private readonly color: PaletteColor,
		private readonly references: readonly string[],
	) {
		super(workflow);
	}

	onOpen(): void {
		super.onOpen();
		this.setTitle('Remove color?');
		this.contentEl.createEl('p', {
			text: `Remove ${this.color.name} from the palette?`,
		});
		if (this.references.length) {
			this.contentEl.createEl('p', {
				text: `This clears ${this.references.length} explicit folder assignment${this.references.length === 1 ? '' : 's'}. Affected folders and their descendants inherit their nearest remaining colored ancestor, or become neutral.`,
			});
			const list = this.contentEl.createEl('ul', {
				cls: 'cfft-reference-list',
			});
			for (const path of this.references)
				list.createEl('li', { text: path });
		}
		let remove: ButtonComponent;
		const feedback = this.lifetime.addChild(
			new ActionFeedback(this.contentEl, this.workflow.store, () => {
				remove?.setDisabled(
					feedback.running || !this.workflow.store.writable,
				);
			}),
		);
		new Setting(this.contentEl)
			.setClass('cfft-dialog-actions')
			.addButton((button) =>
				button.setButtonText('Cancel').onClick(() => this.close()),
			)
			.addButton((button) => {
				remove = button
					.setButtonText('Remove color')
					.setDestructive()
					.setDisabled(!this.workflow.store.writable)
					.onClick(async () => {
						await feedback.run(
							() =>
								this.workflow.deleteColor(
									this.color.id,
									this.references,
								),
							() => this.close(),
						);
					});
			});
		this.contentEl.querySelector<HTMLButtonElement>('button')?.focus();
	}
}
