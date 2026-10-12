import { composite, type Rgba } from '../color/rgba';
import type { CssColors } from './css-colors';

interface SurfaceLayer {
	readonly color: Rgba | null;
	readonly opacity: number;
	readonly hasEffects: boolean;
	readonly hasImage: boolean;
}

/** A render-batch style cache avoids repeatedly measuring shared sidebar/tab ancestors. */
export class SurfaceReader {
	private readonly styles = new Map<Element, CSSStyleDeclaration>();
	private readonly layers = new Map<HTMLElement, SurfaceLayer | null>();
	private readonly effects = new Map<HTMLElement, boolean>();
	private readonly surfaces = new Map<HTMLElement, Rgba | null>();

	/** colors resolves CSS colors in the owning document's sRGB canvas. */
	constructor(private readonly colors: CssColors) {}

	/** Read element's live computed appearance once in this synchronous render batch. */
	style(element: Element): CSSStyleDeclaration | null {
		const cached = this.styles.get(element);
		if (cached) return cached;
		const style =
			element.ownerDocument.defaultView?.getComputedStyle(element);
		if (!style) return null;
		this.styles.set(element, style);
		return style;
	}

	/** Snapshot element's backdrop/effects for this measurement batch; a new reader must follow DOM changes. */
	private layer(element: HTMLElement): SurfaceLayer | null {
		if (this.layers.has(element)) return this.layers.get(element) ?? null;
		const style = this.style(element);
		if (!style) {
			this.layers.set(element, null);
			return null;
		}
		// Computed declarations are live; repeated property getters still enter the browser's style engine.
		const opacity = style.opacity;
		const filter = style.filter;
		const backdropFilter = style.backdropFilter;
		const blend = style.mixBlendMode;
		const image = style.backgroundImage;
		const layer = {
			color: this.colors.read(style.backgroundColor),
			opacity: opacity === '' ? 1 : Number(opacity),
			hasEffects: !!(
				(filter && filter !== 'none') ||
				(backdropFilter && backdropFilter !== 'none') ||
				(blend && blend !== 'normal')
			),
			hasImage: !!(image && image !== 'none'),
		};
		this.layers.set(element, layer);
		return layer;
	}

	/** Check element and its ancestor effects once; opaque children still inherit opacity/filter/blending. */
	private effectsAllowed(element: HTMLElement): boolean {
		const cached = this.effects.get(element);
		if (cached !== undefined) return cached;
		const layer = this.layer(element);
		const parent = element.parentElement;
		const allowed = !!(
			layer &&
			layer.opacity === 1 &&
			!layer.hasEffects &&
			(!parent || this.effectsAllowed(parent))
		);
		this.effects.set(element, allowed);
		return allowed;
	}

	/** Composite element's background with its cached parent backdrop; covered ancestor images are irrelevant. */
	private surface(element: HTMLElement): Rgba | null {
		if (this.surfaces.has(element))
			return this.surfaces.get(element) ?? null;
		const layer = this.layer(element);
		let surface: Rgba | null = null;
		if (layer?.color && !layer.hasImage) {
			if (layer.color.a === 1) surface = layer.color;
			else {
				const parent = element.parentElement;
				const backdrop = parent && this.surface(parent);
				if (backdrop) surface = composite(layer.color, backdrop);
			}
		}
		this.surfaces.set(element, surface);
		return surface;
	}

	/** Composite element's native surface; glyphOpacity excludes the caller's separately modeled glyph opacity. */
	read(element: HTMLElement, glyphOpacity = false): Rgba | null {
		const layer = this.layer(element);
		if (
			!layer ||
			layer.hasEffects ||
			(!glyphOpacity && layer.opacity !== 1)
		)
			return null;
		const parent = element.parentElement;
		if (parent && !this.effectsAllowed(parent)) return null;
		return this.surface(element);
	}
}
