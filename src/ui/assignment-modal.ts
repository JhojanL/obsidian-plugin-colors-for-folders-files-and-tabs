import { Setting, setIcon, type ButtonComponent } from 'obsidian';
import type { ColorWorkflow } from '../settings/workflow';
import { ActionFeedback } from './feedback';
import { ColorModal } from './modal';
import { PalettePanel } from './palette-panel';

/** Apply or clear an explicit folder assignment while palette selection remains a cancelable draft. */
export class AssignmentModal extends ColorModal {
	/** workflow is the common service; path is an existing non-root folder chosen by menu or suggester. */
	constructor(
		workflow: ColorWorkflow,
		private readonly path: string,
	) {
		super(workflow);
	}

	onOpen(): void {
		super.onOpen();
		this.setTitle('Set folder color');
		const context = this.contentEl.createDiv({
			cls: 'cfft-folder-context',
			attr: {
				role: 'group',
				'aria-label': `Folder: ${this.path}`,
				title: this.path,
			},
		});
		const icon = context.createSpan({
			cls: 'cfft-folder-context-icon',
			attr: { 'aria-hidden': 'true' },
		});
		setIcon(icon, 'lucide-folder');
		context.createSpan({
			cls: 'cfft-folder-context-path',
			text: this.path.split('/').join(' / '),
		});
		const summary = this.contentEl.createEl('p', {
			cls: 'cfft-assignment-status cfft-visually-hidden',
			attr: { role: 'status', 'aria-atomic': 'true' },
		});
		const unsaved = this.contentEl.createEl('p', {
			cls: 'cfft-unsaved-status',
			attr: { role: 'status', 'aria-atomic': 'true' },
		});
		let apply: ButtonComponent;
		let inherit: ButtonComponent;
		let update = (): void => {};
		const initial =
			this.workflow.store.settings.assignments[this.path] ??
			this.workflow.store.resolve({ path: this.path, kind: 'folder' })
				?.color.id ??
			null;
		const panel = this.lifetime.addChild(
			new PalettePanel(this.contentEl, this.workflow, {
				selectedId: initial,
				onSelect: () => update(),
			}),
		);
		const feedback = this.lifetime.addChild(
			new ActionFeedback(this.contentEl, this.workflow.store, () =>
				update(),
			),
		);
		new Setting(this.contentEl)
			.setClass('cfft-dialog-actions')
			.addButton((button) => {
				inherit = button
					.setButtonText('Use inherited color')
					.onClick(async () => {
						await feedback.run(
							() => this.workflow.assign(this.path, null),
							() => this.close(),
						);
					});
			})
			.addButton((button) =>
				button.setButtonText('Cancel').onClick(() => this.close()),
			)
			.addButton((button) => {
				apply = button
					.setButtonText('Apply')
					.setCta()
					.onClick(async () => {
						if (panel.selection)
							await feedback.run(
								() =>
									this.workflow.assign(
										this.path,
										panel.selection,
									),
								() => this.close(),
							);
					});
			});
		/** Announce current inheritance, keep save warnings visible, and refresh action availability. */
		update = (): void => {
			const identity = this.workflow.store.resolve({
				path: this.path,
				kind: 'folder',
			});
			summary.setText(
				identity
					? identity.assignedPath === this.path
						? `Assigned ${identity.color.name}.`
						: `Inherits ${identity.color.name} from ${identity.assignedPath}.`
					: 'No colored ancestor. This folder is neutral.',
			);
			unsaved.hidden = !this.workflow.store.hasUnsavedChanges;
			unsaved.setText(
				this.workflow.store.hasUnsavedChanges
					? 'Changes are not saved yet.'
					: '',
			);
			apply?.setDisabled(
				!panel.selection ||
					feedback.running ||
					!this.workflow.store.writable,
			);
			inherit?.setDisabled(
				feedback.running || !this.workflow.store.writable,
			);
		};
		this.lifetime.register(this.workflow.store.subscribe(update));
		update();
		this.contentEl
			.querySelector<HTMLButtonElement>(
				panel.selection
					? '[aria-pressed="true"]'
					: 'button:not(:disabled)',
			)
			?.focus();
	}
}
