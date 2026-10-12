import { Component } from 'obsidian';
import { settingsErrorMessage } from '../settings/notices';
import type { SettingsStore } from '../settings/store';
import { captureFocus } from './focus';

/** Keep failed actions visible with recovery guidance based on the shared persistence state. */
export class ActionFeedback extends Component {
	private busy = false;
	private readonly errorEl: HTMLElement;

	/** parent owns the alert; store supplies unsaved state; changed refreshes controls before/after an action. */
	constructor(
		parent: HTMLElement,
		private readonly store: SettingsStore,
		private readonly changed: () => void = () => {},
	) {
		super();
		this.errorEl = parent.createDiv({
			cls: 'cfft-error',
			attr: { role: 'alert', 'aria-atomic': 'true' },
		});
	}

	get running(): boolean {
		return this.busy;
	}

	/**
	 * Run operation once at a time; saved runs only on success and defaults to no action.
	 * A busy call is ignored, so callers must disable every control sharing this guard.
	 * Failures keep the view open and report retained settings only when the store has an unsaved snapshot.
	 */
	async run(
		operation: () => Promise<void>,
		saved: () => void = () => {},
	): Promise<void> {
		if (this.busy) return;
		const doc = this.errorEl.ownerDocument;
		const focus = captureFocus(doc);
		this.busy = true;
		this.errorEl.setText('');
		this.changed();
		try {
			await operation();
			saved();
		} catch (error) {
			this.errorEl.setText(settingsErrorMessage(error, this.store));
		} finally {
			this.busy = false;
			this.changed();
			if (doc.activeElement === doc.body) focus.restore();
		}
	}
}
