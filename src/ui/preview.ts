import { Component, type App } from 'obsidian';
import { Appearance } from '../adapters/appearance';
import { ColorEngine } from '../color/engine';
import { toHex } from '../color/rgba';
import type { ColorSeed, PaletteColor } from '../model/types';

export interface PreviewTarget {
	readonly element: HTMLElement;
	readonly color: PaletteColor;
	readonly showText?: boolean;
}

/** Measure controls in their own document and reuse the Explorer/tab contrast engine for previews. */
export class ColorPreview extends Component {
	private readonly engine = new ColorEngine();
	private readonly appearance = new Appearance(() => {
		this.engine.invalidate();
		this.render();
	});

	/** app provides theme-change events; targets returns only currently rendered palette/preview controls. */
	constructor(
		private readonly app: App,
		private readonly targets: () => readonly PreviewTarget[],
	) {
		super();
	}

	onload(): void {
		this.registerEvent(
			this.app.workspace.on('css-change', this.appearance.invalidate),
		);
		this.register(() => {
			this.appearance.dispose();
			this.engine.invalidate();
		});
		this.render();
	}

	/** Resolve seed to hex on element's current theme; unknown theme tokens do not fabricate a color. */
	seedHex(seed: ColorSeed, element: HTMLElement): string | null {
		this.appearance.begin();
		const context = this.appearance.context(element, seed, element);
		return context.seed ? toHex(context.seed) : null;
	}

	/** Adapt visible targets' accents and optional sample text without changing host backgrounds. */
	render(): void {
		this.appearance.begin();
		for (const { element, color, showText } of this.targets()) {
			const colors = this.engine.render(
				{ color, role: 'folder', assignedPath: '', relativeDepth: 0 },
				'folder',
				this.appearance.context(element, color.seed, element),
			);
			element.style.setProperty(
				'--cfft-preview-accent',
				colors?.accent ?? '',
			);
			element.style.setProperty(
				'--cfft-preview-text',
				showText
					? (colors?.text ?? 'var(--text-normal)')
					: 'var(--text-normal)',
			);
			element.dataset.previewStatus = colors?.status ?? 'accent-only';
		}
	}
}
