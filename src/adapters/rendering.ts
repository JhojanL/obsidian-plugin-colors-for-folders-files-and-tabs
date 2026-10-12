import { ColorEngine } from '../color/engine';
import { contrastRatio, meetsContrast } from '../color/contrast';
import type { RenderRole } from '../color/variants';
import type { ColorIdentity, ColoringOptions } from '../model/types';
import { DEFAULT_COLORING } from '../model/settings';
import { Appearance } from './appearance';

/** Adapted opaque foregrounds; a null channel retains native presentation. */
export interface DecorationColors {
	readonly text: `#${string}` | null;
	readonly icon: `#${string}` | null;
}

/** One adapter's prepared targets and their shared-batch verification/cleanup contract. */
export interface DecorationUpdate {
	/** Read prepared surfaces and return the synchronous foreground commit. */
	readonly measure: () => () => void;
	/** Read final surfaces without writes and identify documents needing native foregrounds. */
	readonly unsafeDocuments: () => readonly Document[];
	/** Restore this update's native foregrounds in doc without removing decorative glyphs. */
	readonly clear: (doc: Document) => void;
}

/** Share the color engine and measured appearance between Explorer and tab adapters. */
export class RenderingPipeline {
	private readonly engine = new ColorEngine();
	private readonly appearance: Appearance;
	private pendingUpdates: DecorationUpdate[] | null = null;

	/** refresh batches live appearance changes; preferences reads the latest independent coloring flags. */
	constructor(
		refresh: () => void = () => {},
		private readonly preferences: () => ColoringOptions = () =>
			DEFAULT_COLORING,
	) {
		this.appearance = new Appearance(() => {
			this.engine.invalidate();
			refresh();
		});
	}

	/** Read the latest flags before preparing selectors for the intended presentation. */
	get coloring(): ColoringOptions {
		return this.preferences();
	}

	/** Discard measured styles after preparation or foreground commits change the DOM. */
	begin(): void {
		this.appearance.begin();
	}

	/** Run action's synchronous setup, then adapt and verify foregrounds on separate shared read phases. */
	batch(action: () => void): void {
		if (this.pendingUpdates) {
			action();
			return;
		}
		const updates: DecorationUpdate[] = [];
		this.pendingUpdates = updates;
		try {
			action();
			this.flush(updates);
		} finally {
			this.pendingUpdates = null;
		}
	}

	/** Queue update after its selector preparation; outside a shared batch, reconcile it immediately. */
	reconcile(update: DecorationUpdate): void {
		if (this.pendingUpdates) this.pendingUpdates.push(update);
		else this.flush([update]);
	}

	/** Commit updates together; an unsafe final surface restores native foregrounds across that document's batch. */
	private flush(updates: readonly DecorationUpdate[]): void {
		this.begin();
		const commits = updates.map((update) => update.measure());
		for (const commit of commits) commit();
		this.begin();
		const unsafe = new Set(
			updates.flatMap((update) => update.unsafeDocuments()),
		);
		// Cross-surface :has() rules can change siblings when a fallback removes a class.
		// Clear the affected document together; never iterate toward a CSS fixed point.
		for (const doc of unsafe)
			for (const update of updates) update.clear(doc);
	}

	/** Check colors against element's final child surfaces; disabled/native channels require no contrast claim. */
	isReadable(colors: DecorationColors, element: HTMLElement): boolean {
		return (
			(!colors.text ||
				this.hasContrast(
					element.querySelector<HTMLElement>(
						'.nav-folder-title-content, .nav-file-title-content',
					),
					colors.text,
					4.5,
				)) &&
			(!colors.icon ||
				this.hasContrast(
					element.querySelector<HTMLElement>('.cfft-type-icon'),
					colors.icon,
					3,
					true,
				))
		);
	}

	/** Check color on element against minimum's unrounded ratio; glyph permits modeled opacity on a transparent icon. */
	private hasContrast(
		element: HTMLElement | null,
		color: `#${string}`,
		minimum: number,
		glyph = false,
	): boolean {
		if (!element) return false;
		const context = this.appearance.context(element, color, element, glyph);
		return !!(
			context.seed &&
			context.surface &&
			meetsContrast(
				contrastRatio(
					{
						...context.seed,
						a: context.seed.a * (context.foregroundOpacity ?? 1),
					},
					context.surface,
				),
				minimum,
			)
		);
	}

	/** Measure identity's enabled labels/glyphs on element for role; null means no requested element or invalid seed, while unsupported surfaces retain native channel colors. */
	render(
		identity: ColorIdentity,
		element: HTMLElement,
		role: RenderRole,
	): DecorationColors | null {
		const options = this.preferences();
		if (role === 'tab' && !options.tabs) return null;
		const title =
			role !== 'tab' && options.text
				? element.querySelector<HTMLElement>(
						'.nav-folder-title-content, .nav-file-title-content',
					)
				: null;
		const icon = (role === 'tab' ? options.tabs : options.icons)
			? element.querySelector<HTMLElement>('.cfft-type-icon')
			: null;
		const textColors = title
			? this.engine.render(
					identity,
					role,
					this.appearance.context(
						title,
						identity.color.seed,
						element,
					),
					'text',
				)
			: null;
		const iconColors = icon
			? this.engine.render(
					identity,
					role,
					this.appearance.context(
						icon,
						identity.color.seed,
						element,
						true,
					),
					'icon',
				)
			: null;
		if (!textColors && !iconColors) return null;
		return {
			text: textColors?.text ?? null,
			icon: iconColors?.icon ?? null,
		};
	}

	/** Re-evaluate live CSS changes without changing stored palette seeds. */
	readonly invalidate = (): void => this.appearance.invalidate();

	/** Release the color parser and observer owned by closing doc. */
	releaseDocument(doc: Document): void {
		this.appearance.releaseDocument(doc);
	}

	/** Drop cached colors and disconnect appearance observers on unload. */
	dispose(): void {
		this.pendingUpdates = null;
		this.appearance.dispose();
		this.engine.invalidate();
	}
}
