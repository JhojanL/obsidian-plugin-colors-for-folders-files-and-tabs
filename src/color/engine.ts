import { readColorSeed } from '../model/settings';
import type { ColorIdentity } from '../model/types';
import { adaptColor } from './adapt';
import { contrastRatio } from './contrast';
import { parseColor, validRgba, type Rgba } from './rgba';
import {
	depthBand,
	varyColor,
	type AppearanceMode,
	type RenderRole,
} from './variants';

export type RenderState = 'normal' | 'hover' | 'selected' | 'focus';

// Small buffers cover browser normalization to 8-bit sRGB; WCAG comparisons themselves stay unrounded.
const TEXT_CONTRAST = 4.6;
const INDICATOR_CONTRAST = 3.1;

/** Measured colors refer to the current document and actual rendered interaction state. */
export interface RenderContext {
	readonly mode: AppearanceMode | null;
	readonly revision: number;
	readonly seed: Rgba | null;
	readonly surface: Rgba | null;
	readonly state: RenderState;
	/** Existing glyph opacity; defaults to 1. Row/group opacity is not modeled. */
	readonly foregroundOpacity?: number;
}

export interface RenderColors {
	readonly accent: string;
	readonly text: `#${string}` | null;
	readonly icon: `#${string}` | null;
	readonly status: 'evaluated' | 'accent-only';
	readonly textContrast: number | null;
	readonly indicatorContrast: number | null;
}

/** One bounded rendering cache for Explorer, tabs, and future palette previews. */
export class ColorEngine {
	private readonly cache = new Map<string, RenderColors>();

	/**
	 * Derive identity's role variant on context's measured surface. An optional
	 * channel evaluates one foreground; omitting it evaluates both. Unsupported
	 * surfaces preserve host colors.
	 */
	render(
		identity: ColorIdentity,
		role: RenderRole,
		context: RenderContext,
		channel?: 'text' | 'icon',
	): RenderColors | null {
		const seed = readColorSeed(identity.color.seed);
		if (!seed) return null;
		const fallback: RenderColors = Object.freeze({
			accent: seed.startsWith('#') ? seed : `var(${seed})`,
			text: null,
			icon: null,
			status: 'accent-only',
			textContrast: null,
			indicatorContrast: null,
		});
		if (
			!context.mode ||
			!context.seed ||
			!context.surface ||
			!validRgba(context.seed) ||
			context.seed.a !== 1 ||
			!validRgba(context.surface) ||
			context.surface.a !== 1
		)
			return fallback;
		const opacity = context.foregroundOpacity ?? 1;
		if (!Number.isFinite(opacity) || opacity < 0 || opacity > 1)
			return fallback;
		const key = JSON.stringify([
			channel ?? 'both',
			seed,
			context.seed,
			depthBand(identity.relativeDepth),
			role,
			context.mode,
			context.revision,
			context.surface,
			context.state,
			opacity,
		]);
		const cached = this.cache.get(key);
		if (cached) return cached;
		const variant = varyColor(
			context.seed,
			identity.relativeDepth,
			role,
			context.mode,
		);
		if (!variant) return fallback;
		const text =
			channel === 'icon'
				? null
				: adaptColor(variant, context.surface, TEXT_CONTRAST, opacity);
		const icon =
			channel === 'text'
				? null
				: adaptColor(
						variant,
						context.surface,
						INDICATOR_CONTRAST,
						opacity,
					);
		const colors: RenderColors = Object.freeze({
			accent: icon ?? fallback.accent,
			text,
			icon,
			status:
				(channel === 'icon' || text) && (channel === 'text' || icon)
					? 'evaluated'
					: 'accent-only',
			textContrast: text
				? contrastRatio(
						{ ...parseColor(text)!, a: opacity },
						context.surface,
					)
				: null,
			indicatorContrast: icon
				? contrastRatio(
						{ ...parseColor(icon)!, a: opacity },
						context.surface,
					)
				: null,
		});
		if (this.cache.size >= 1024) this.cache.clear();
		this.cache.set(key, colors);
		return colors;
	}

	/** Forget adapted values after a live appearance change or plugin unload. */
	invalidate(): void {
		this.cache.clear();
	}
}
