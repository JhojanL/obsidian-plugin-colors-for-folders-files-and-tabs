import type { RenderContext, RenderState } from '../color/engine';
import type { ColorSeed } from '../model/types';
import { CssColors } from './css-colors';
import { SurfaceReader } from './surfaces';

/** Derive live interaction state from host classes/pseudo-classes without changing host selection. */
function readState(element: HTMLElement): RenderState {
	if (
		element.matches(
			'.is-active, .is-selected, [aria-selected="true"], [aria-current="true"]',
		)
	)
		return 'selected';
	if (element.matches(':hover')) return 'hover';
	if (element.matches('.has-focus, :focus-visible, :focus-within'))
		return 'focus';
	return 'normal';
}

/** Observe Obsidian's document appearance, rather than the OS preferred color scheme. */
export class Appearance {
	private revision = 0;
	private readonly documents = new Map<
		Document,
		{ colors: CssColors; observer: MutationObserver }
	>();
	private readonly readers = new Map<Document, SurfaceReader>();

	/** changed invalidates the shared engine and queues an adapter refresh on live mode/theme edits. */
	constructor(private readonly changed: () => void) {}

	/** Discard computed styles before a synchronous adapter render batch. */
	begin(): void {
		this.readers.clear();
	}

	/** Track doc's appearance and create its per-batch reader, including newly opened pop-outs. */
	private reader(doc: Document): SurfaceReader | null {
		let entry = this.documents.get(doc);
		const win = doc.defaultView;
		if (!entry && win && doc.body) {
			const observer = new win.MutationObserver(this.invalidate);
			observer.observe(doc.body, {
				attributes: true,
				attributeFilter: ['class', 'style'],
			});
			observer.observe(doc.documentElement, {
				attributes: true,
				attributeFilter: ['class', 'style'],
			});
			entry = { colors: new CssColors(doc), observer };
			this.documents.set(doc, entry);
		}
		if (!entry) return null;
		let reader = this.readers.get(doc);
		if (!reader) {
			reader = new SurfaceReader(entry.colors);
			this.readers.set(doc, reader);
		}
		return reader;
	}

	/** Measure seed/element's surface using stateElement's interaction and Obsidian's mode; glyph permits own opacity on a transparent icon. */
	context(
		element: HTMLElement,
		seed: ColorSeed,
		stateElement: HTMLElement,
		glyph = false,
	): RenderContext {
		const doc = element.ownerDocument;
		const reader = this.reader(doc);
		const style = reader?.style(element);
		const colors = this.documents.get(doc)?.colors;
		const classes = doc.body.classList;
		const glyphOpacity = !!(
			glyph &&
			style &&
			colors?.read(style.backgroundColor)?.a === 0
		);
		return {
			mode: classes.contains('theme-dark')
				? 'dark'
				: classes.contains('theme-light')
					? 'light'
					: null,
			revision: this.revision,
			seed:
				colors?.read(
					seed.startsWith('#')
						? seed
						: (style?.getPropertyValue(seed) ?? ''),
				) ?? null,
			surface: reader?.read(element, glyphOpacity) ?? null,
			state: readState(stateElement),
			foregroundOpacity:
				glyphOpacity && style?.opacity ? Number(style.opacity) : 1,
		};
	}

	/** Advance theme revision for workspace css-change events and observed appearance edits. */
	readonly invalidate = (): void => {
		this.revision++;
		this.readers.clear();
		this.changed();
	};

	/** Release a closing document's observer, style cache, and CSS color canvas. */
	releaseDocument(doc: Document): void {
		this.documents.get(doc)?.observer.disconnect();
		this.documents.delete(doc);
		this.readers.delete(doc);
	}

	/** Disconnect every appearance observer on unload. */
	dispose(): void {
		for (const doc of this.documents.keys()) this.releaseDocument(doc);
	}
}
