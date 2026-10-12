import { Component, Modal } from 'obsidian';
import type { ColorWorkflow } from '../settings/workflow';
import { captureFocus, type FocusReturn } from './focus';

/** Own subscriptions and focus restoration for all color dialogs, including nested palette edits. */
export class ColorModal extends Modal {
	protected readonly lifetime = new Component();
	private focusReturn: FocusReturn | null = null;
	protected opened = false;

	/** workflow supplies the shared store and owns this dialog's unload cleanup. */
	constructor(protected readonly workflow: ColorWorkflow) {
		super(workflow.app);
		this.modalEl.addClass('cfft-controls', 'cfft-modal');
	}

	open(): void {
		// Native modals can move into the settings pop-out after their initial DOM creation.
		this.focusReturn = captureFocus(
			this.modalEl.ownerDocument.win.activeDocument,
		);
		super.open();
	}

	onOpen(): void {
		this.opened = true;
		this.lifetime.load();
	}

	onClose(): void {
		this.opened = false;
		this.lifetime.unload();
		this.contentEl.empty();
		this.workflow.release(this);
		const focusReturn = this.focusReturn;
		queueMicrotask(() => focusReturn?.restore());
	}
}
