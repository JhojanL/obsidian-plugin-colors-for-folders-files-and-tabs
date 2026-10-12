import type { ColorResolver, ColorTarget } from './contracts';
import { RenderingPipeline, type DecorationColors } from './rendering';
import type { ColorIdentity } from '../model/types';
import type { RenderRole } from '../color/variants';
import { FileIcons } from './file-icons';

const PRESENTATION_CLASSES = ['cfft-text-color', 'cfft-icon-color'];
const PROPERTIES = ['--cfft-text', '--cfft-icon'];

export interface DecorationTarget {
	element: HTMLElement;
	identity: ColorTarget | null;
}

/** Own namespaced glyphs/classes/properties while preserving native interaction state and children. */
export class Decoration {
	private readonly elements = new Set<HTMLElement>();
	private readonly documents = new Set<Document>();
	private readonly roots = new Set<HTMLElement>();
	private readonly rendering: RenderingPipeline;
	private readonly ownsRendering: boolean;
	private readonly icons: FileIcons;
	private readonly selector: string;

	/** ownedClass identifies the adapter; resolveColor reads identities; rendering optionally shares a pipeline. */
	constructor(
		private readonly ownedClass: string,
		private readonly resolveColor: ColorResolver,
		rendering?: RenderingPipeline,
	) {
		this.rendering = rendering ?? new RenderingPipeline();
		this.ownsRendering = !rendering;
		this.icons = new FileIcons(
			ownedClass === 'cfft-tab-color' ? 'tab' : 'explorer',
		);
		this.selector = `.${ownedClass}, .${this.icons.ownedClass}`;
	}

	/** Reconcile targets' identities and remove orphaned host clones inside roots, retaining nodes only for cleanup. */
	render(
		targets: readonly DecorationTarget[],
		roots: readonly HTMLElement[],
	): void {
		const previous = new Set(this.elements);
		for (const root of new Set([...this.roots, ...roots])) {
			for (const element of root.querySelectorAll<HTMLElement>(
				this.selector,
			)) {
				previous.add(element);
			}
		}
		this.roots.clear();
		for (const root of roots) this.roots.add(root);
		this.elements.clear();
		const options = this.rendering.coloring;
		// Background selectors must see all adapters' intended classes before any surface reads.
		const prepared = targets.map(({ element, identity }) => {
			if (this.icons.render(element, identity)) this.track(element);
			let resolved: ColorIdentity | null = null;
			try {
				resolved = identity && this.resolveColor(identity);
			} catch {
				// A missing or unsupported identity must not interrupt the host UI.
			}
			const role: RenderRole =
				this.ownedClass === 'cfft-tab-color'
					? 'tab'
					: (resolved?.role ?? 'file');
			const enabled = [
				role !== 'tab' && options.text,
				role === 'tab' ? options.tabs : options.icons,
			];
			element.classList.toggle(
				this.ownedClass,
				!!resolved && enabled.some(Boolean),
			);
			for (const [index, name] of PRESENTATION_CLASSES.entries())
				element.classList.toggle(name, !!resolved && !!enabled[index]);
			if (!resolved) this.clearColors(element);
			return { element, resolved, role };
		});
		for (const element of previous) {
			if (!this.elements.has(element)) this.clearElement(element);
		}
		let rendered: {
			element: HTMLElement;
			colors: DecorationColors | null;
		}[] = [];
		this.rendering.reconcile({
			measure: () => {
				rendered = prepared.map(({ element, resolved, role }) => {
					let colors: DecorationColors | null = null;
					try {
						if (resolved)
							colors = this.rendering.render(
								resolved,
								element,
								role,
							);
					} catch {
						// Unsupported host appearance must leave this target neutral.
					}
					return { element, colors };
				});
				return () => {
					// Applying foregrounds between reads forces the browser to recalculate styles for later rows/adapters.
					for (const { element, colors } of rendered) {
						if (!colors) {
							this.clearColors(element);
							continue;
						}
						this.track(element);
						if (!element.classList.contains(this.ownedClass)) {
							element.classList.add(this.ownedClass);
						}
						const values = [colors.text, colors.icon];
						for (const [index, property] of PROPERTIES.entries()) {
							const value = values[index];
							const presentation = PRESENTATION_CLASSES[index];
							if (presentation)
								element.classList.toggle(presentation, !!value);
							if (value && presentation) {
								if (
									element.style.getPropertyValue(property) !==
									value
								)
									element.style.setProperty(property, value);
							} else if (element.style.getPropertyValue(property))
								element.style.removeProperty(property);
						}
					}
				};
			},
			unsafeDocuments: () =>
				rendered.flatMap(({ element, colors }) =>
					colors && !this.rendering.isReadable(colors, element)
						? [element.ownerDocument]
						: [],
				),
			clear: (doc) => {
				for (const { element } of rendered)
					if (element.ownerDocument === doc)
						this.clearColors(element);
			},
		});
	}

	/** Release a closing document, including decorations copied by host tab animations. */
	releaseDocument(doc: Document): void {
		for (const element of doc.querySelectorAll<HTMLElement>(
			this.selector,
		)) {
			this.clearElement(element);
		}
		for (const element of this.elements) {
			if (element.ownerDocument === doc) {
				this.clearElement(element);
				this.elements.delete(element);
			}
		}
		for (const root of this.roots) {
			if (root.ownerDocument !== doc) continue;
			for (const element of root.querySelectorAll<HTMLElement>(
				this.selector,
			)) {
				this.clearElement(element);
			}
			this.roots.delete(root);
		}
		this.documents.delete(doc);
		this.rendering.releaseDocument(doc);
	}

	/** Remove all tracked styles, including detached rows and affected pop-out documents. */
	dispose(): void {
		// Nodes can move to another document before the next host snapshot.
		const documents = new Set(this.documents);
		for (const element of this.elements)
			documents.add(element.ownerDocument);
		for (const root of this.roots) documents.add(root.ownerDocument);
		for (const doc of documents) this.releaseDocument(doc);
		this.elements.clear();
		this.roots.clear();
		if (this.ownsRendering) this.rendering.dispose();
	}

	/** Clear only this adapter's owned decoration on an element. */
	private clearElement(element: HTMLElement): void {
		this.icons.clear(element);
		this.clearColors(element);
	}

	/** Retain element for cleanup even when its icon uses neutral native colors. */
	private track(element: HTMLElement): void {
		this.documents.add(element.ownerDocument);
		this.elements.add(element);
	}

	/** Restore element's foreground colors without removing its file-type icon. */
	private clearColors(element: HTMLElement): void {
		const classes = [this.ownedClass, ...PRESENTATION_CLASSES].filter(
			(name) => element.classList.contains(name),
		);
		if (classes.length > 0) element.classList.remove(...classes);
		for (const property of PROPERTIES)
			if (element.style.getPropertyValue(property))
				element.style.removeProperty(property);
		if (element.style.length === 0 && element.hasAttribute('style'))
			element.removeAttribute('style');
	}
}
