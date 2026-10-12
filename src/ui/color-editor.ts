import {
	Setting,
	type ButtonComponent,
	type ColorComponent,
	type TextComponent,
} from 'obsidian';
import {
	THEME_COLOR_TOKENS,
	type ColorSeed,
	type PaletteColor,
} from '../model/types';
import type { ColorWorkflow } from '../settings/workflow';
import { readColorDraft } from './color-draft';
import { ActionFeedback } from './feedback';
import { ColorModal } from './modal';
import { ColorPreview } from './preview';

/** Keep custom color inputs local until Apply; picker and hex edits share one validation path. */
export class ColorEditor extends ColorModal {
	private readonly id: string;
	private name = '';
	private hex = '#8b6cef';
	private seedChanged = false;
	private draft: PaletteColor | null = null;

	/** workflow persists validated drafts; original supplies a stable ID and optional theme seed for editing. */
	constructor(
		workflow: ColorWorkflow,
		private readonly original?: PaletteColor,
	) {
		super(workflow);
		this.id = original?.id ?? `custom-${crypto.randomUUID()}`;
		this.name = original?.name ?? '';
	}

	onOpen(): void {
		super.onOpen();
		this.setTitle(this.original ? 'Edit color' : 'Add color');
		let nameInput: TextComponent;
		let hexInput: TextComponent;
		let picker: ColorComponent;
		let apply: ButtonComponent;
		let validate = (_showErrors = false): void => {};
		/** Route picker or hex value through the same validator and synchronize valid picker values. */
		const setHex = (value: string): void => {
			this.seedChanged = true;
			this.hex = value;
			hexInput.setValue(value);
			const result = readColorDraft(this.id, this.name, value);
			if (!result.hexError) picker.setValue(value.trim());
			validate();
		};
		const nameError = this.contentEl.createDiv({
			cls: 'cfft-error',
			attr: { id: `${this.id}-name-error`, role: 'status' },
		});
		const nameSetting = new Setting(this.contentEl)
			.setName('Color name')
			.addText((input) => {
				nameInput = input;
				input.setValue(this.name).onChange((value) => {
					this.name = value;
					validate();
				});
				input.inputEl.setAttribute('aria-label', 'Color name');
				input.inputEl.setAttribute('aria-describedby', nameError.id);
			});
		nameSetting.settingEl.after(nameError);
		const pickerSetting = new Setting(this.contentEl)
			.setName('Color picker')
			.addColorPicker((input) => {
				picker = input;
			});
		const pickerInput =
			pickerSetting.controlEl.querySelector<HTMLInputElement>('input');
		pickerInput?.setAttribute('aria-label', 'Color picker');
		const hexError = this.contentEl.createDiv({
			cls: 'cfft-error',
			attr: { id: `${this.id}-hex-error`, role: 'status' },
		});
		const hexSetting = new Setting(this.contentEl)
			.setName('Hex color')
			.setDesc('Use # followed by six hex digits.')
			.addText((input) => {
				hexInput = input;
				input.setValue(this.hex).onChange((value) => setHex(value));
				input.inputEl.setAttribute('aria-label', 'Hex color');
				input.inputEl.setAttribute('aria-describedby', hexError.id);
				input.inputEl.spellcheck = false;
			});
		hexSetting.settingEl.after(hexError);
		pickerInput?.setAttribute('aria-describedby', hexError.id);
		if (this.original?.seed.startsWith('--'))
			this.contentEl.createEl('p', {
				cls: 'setting-item-description',
				text: 'This color follows your theme until you change its hex value.',
			});
		const sample = this.contentEl.createDiv({ cls: 'cfft-color-preview' });
		sample.createSpan({
			cls: 'cfft-swatch',
			attr: { 'aria-hidden': 'true' },
		});
		const label = sample.createSpan({ text: 'Folder preview' });
		this.contentEl.createEl('p', {
			cls: 'setting-item-description',
			text: 'Preview adjusts the color for this appearance. Descendants use subtle variations.',
		});
		const preview = this.lifetime.addChild(
			new ColorPreview(this.app, () =>
				this.draft
					? [
							{
								element: sample,
								color: this.draft,
								showText:
									this.workflow.store.settings.coloring.text,
							},
						]
					: [],
			),
		);
		if (this.original)
			this.hex = preview.seedHex(this.original.seed, sample) ?? '#808080';
		const resolveSeedHex = (seed: ColorSeed): string | null =>
			preview.seedHex(seed, sample);
		hexInput!.setValue(this.hex);
		picker!.setValue(this.hex);
		// Native setValue invokes onChange; initialize before tracking user edits.
		picker!.onChange((value) => setHex(value));
		const feedback = this.lifetime.addChild(
			new ActionFeedback(this.contentEl, this.workflow.store, () =>
				validate(),
			),
		);
		const actions = new Setting(this.contentEl)
			.addButton((button) =>
				button.setButtonText('Cancel').onClick(() => this.close()),
			)
			.addButton((button) => {
				apply = button
					.setButtonText('Apply')
					.setCta()
					.onClick(async () => {
						validate(true);
						if (this.draft) {
							const color = this.draft;
							// Queued saves must not retain the editor's appearance observers.
							const themeHexes = new Map<
								ColorSeed,
								string | null
							>(
								THEME_COLOR_TOKENS.map((seed) => [
									seed,
									resolveSeedHex(seed),
								]),
							);
							await feedback.run(
								() =>
									this.workflow.store.putColor(
										color,
										(seed) =>
											seed.startsWith('#')
												? seed
												: (themeHexes.get(seed) ??
													null),
									),
								() => this.close(),
							);
						} else if (
							nameInput!.inputEl.getAttribute('aria-invalid') ===
							'true'
						)
							nameInput!.inputEl.focus();
						else hexInput!.inputEl.focus();
					});
			});
		actions.settingEl.addClass('cfft-dialog-actions');

		/** Validate edits while open; showErrors also exposes the initially empty name error on submission. */
		validate = (showErrors = false): void => {
			if (!this.opened) return;
			const result = readColorDraft(this.id, this.name, this.hex, {
				palette: this.workflow.store.settings.palette,
				resolveSeedHex,
				retainedSeed: !this.seedChanged
					? this.original?.seed
					: undefined,
			});
			this.draft = result.color;
			nameError.setText(
				showErrors || this.name !== '' ? result.nameError : '',
			);
			hexError.setText(result.hexError);
			nameInput!.inputEl.setAttribute(
				'aria-invalid',
				String(!!result.nameError),
			);
			hexInput!.inputEl.setAttribute(
				'aria-invalid',
				String(!!result.hexError),
			);
			pickerInput?.setAttribute(
				'aria-invalid',
				String(!!result.hexError),
			);
			apply?.setDisabled(
				!this.draft ||
					feedback.running ||
					!this.workflow.store.writable,
			);
			label.setText(this.draft?.name || 'Folder preview');
			sample.hidden = !this.draft;
			preview.render();
		};
		this.lifetime.register(this.workflow.store.subscribe(() => validate()));
		this.lifetime.registerEvent(
			this.app.workspace.on('css-change', () => validate()),
		);
		validate();
		nameInput!.inputEl.focus();
	}
}
