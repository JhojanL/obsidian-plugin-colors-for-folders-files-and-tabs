import { ButtonComponent, Component, Setting } from 'obsidian';
import type { ColorWorkflow } from '../settings/workflow';
import { captureFocus } from './focus';
import { ColorPreview, type PreviewTarget } from './preview';

interface PalettePanelOptions {
	readonly selectedId?: string | null;
	readonly onSelect?: (id: string | null) => void;
	readonly addButtonParent?: HTMLElement;
}

/** Reuse named, keyboard-operable swatches and palette management in settings and assignment dialogs. */
export class PalettePanel extends Component {
	private selectedId: string | null;
	private readonly grid: HTMLElement;
	private readonly status: HTMLElement;
	private readonly add: ButtonComponent;
	private readonly preview: ColorPreview;
	private targets: PreviewTarget[] = [];
	private renderedState = '';

	/** parent owns the panel; workflow shares persistence; options retain draft selection and an optional section header. */
	constructor(
		parent: HTMLElement,
		private readonly workflow: ColorWorkflow,
		private readonly options: PalettePanelOptions = {},
	) {
		super();
		this.selectedId = options.selectedId ?? null;
		const panel = parent.createDiv({ cls: 'cfft-palette' });
		const header =
			options.addButtonParent ??
			new Setting(panel)
				.setName('Palette')
				.setHeading()
				.setClass('cfft-palette-heading').controlEl;
		this.add = new ButtonComponent(header)
			.setButtonText('Add color')
			.setCta()
			.onClick(() => this.workflow.editColor());
		this.add.buttonEl.dataset.cfftFocus = 'add-color';
		this.grid = panel.createDiv({
			cls: 'cfft-palette-grid',
			attr: { role: 'group', 'aria-label': 'Palette colors' },
		});
		this.status = panel.createDiv({
			cls: 'cfft-selection-status cfft-visually-hidden',
			attr: { role: 'status', 'aria-atomic': 'true' },
		});
		this.preview = this.addChild(
			new ColorPreview(workflow.app, () => this.targets),
		);
	}

	get selection(): string | null {
		return this.selectedId;
	}

	onload(): void {
		this.register(this.workflow.store.subscribe(() => this.render()));
		this.render();
	}

	/** Refresh named swatches and selected state while preserving focused controls by stable color ID. */
	private render(): void {
		const { palette } = this.workflow.store.settings;
		const state = JSON.stringify([
			palette,
			this.selectedId,
			this.workflow.store.writable,
		]);
		if (state === this.renderedState) return;
		this.renderedState = state;
		const focus = captureFocus(this.grid.ownerDocument);
		if (
			this.selectedId !== null &&
			!palette.some((color) => color.id === this.selectedId)
		) {
			this.selectedId = null;
			this.options.onSelect?.(null);
		}
		this.grid.empty();
		this.targets = [];
		for (const color of palette) {
			const chosen = color.id === this.selectedId;
			const row = this.grid.createDiv({
				cls: chosen
					? 'cfft-palette-row is-selected'
					: 'cfft-palette-row',
			});
			const button = new ButtonComponent(row)
				.setDisabled(!this.workflow.store.writable)
				.onClick(() => {
					this.selectedId = color.id;
					this.render();
					this.options.onSelect?.(color.id);
				});
			button.buttonEl.addClass('cfft-palette-select');
			button.buttonEl.setAttribute('aria-label', color.name);
			button.buttonEl.setAttribute('aria-pressed', String(chosen));
			button.buttonEl.dataset.cfftFocus = `palette-${color.id}`;
			button.buttonEl.createSpan({
				cls: 'cfft-swatch',
				attr: { 'aria-hidden': 'true' },
			});
			const label = button.buttonEl.createSpan({
				cls: 'cfft-color-label',
			});
			label.createSpan({
				cls: 'cfft-color-name',
				text: color.name,
			});
			this.targets.push({ element: button.buttonEl, color });
			for (const [action, icon, callback] of [
				['Edit', 'pencil', () => this.workflow.editColor(color)],
				[
					'Delete',
					'trash-2',
					() => this.workflow.removeColor(color.id),
				],
			] as const) {
				const label = `${action} ${color.name}`;
				const control = new ButtonComponent(row)
					.setIcon(icon)
					.setTooltip(label)
					.setDisabled(!this.workflow.store.writable)
					.onClick(callback);
				control.buttonEl.addClass(
					'clickable-icon',
					'cfft-palette-action',
				);
				control.buttonEl.setAttribute('aria-label', label);
				control.buttonEl.dataset.cfftFocus = `${action.toLowerCase()}-${color.id}`;
			}
		}
		if (!palette.length)
			this.grid.createDiv({
				text: 'No colors yet. Select Add color to begin.',
			});
		const color = palette.find((entry) => entry.id === this.selectedId);
		this.status.setText(
			color ? `${color.name} selected.` : 'Select a color.',
		);
		this.add.setDisabled(!this.workflow.store.writable);
		this.preview.render();
		focus.restore();
	}
}
