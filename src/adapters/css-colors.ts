import { parseColor, type Rgba } from '../color/rgba';

/** Resolve browser-supported CSS colors in doc to sRGB, including modern theme color-mix/OKLCH values. */
export class CssColors {
	private readonly cache = new Map<string, Rgba | null>();
	private context: CanvasRenderingContext2D | null | undefined;

	/** doc owns the color parser/canvas, so pop-outs use their own browser realm. */
	constructor(private readonly doc: Document) {}

	/** Parse value without executing CSS expressions or guessing an unsupported color. */
	read(value: string): Rgba | null {
		const direct = parseColor(value);
		if (direct) return direct;
		if (this.cache.has(value)) return this.cache.get(value) ?? null;
		let color: Rgba | null = null;
		const win = this.doc.defaultView;
		if (
			win?.CSS?.supports('color', value) &&
			!/\b(?:var|env|currentcolor|inherit|initial|unset|revert|light-dark)\b/i.test(
				value,
			)
		) {
			try {
				if (this.context === undefined) {
					const canvas = this.doc.adoptNode(createEl('canvas'));
					canvas.width = canvas.height = 1;
					this.context = canvas.getContext('2d', {
						willReadFrequently: true,
					});
				}
				if (this.context) {
					// Preserve computed modern-color alpha before canvas quantization.
					const alpha = /\/\s*([\d.]+)(%)?\s*\)$/.exec(value);
					const exactAlpha = alpha
						? Number(alpha[1]) / (alpha[2] ? 100 : 1)
						: null;
					this.context.clearRect(0, 0, 1, 1);
					const opaqueValue =
						exactAlpha === null
							? value
							: value.replace(/\/[^/]*\)$/, '/ 1)');
					// Canvas silently ignores unsupported fill styles; two sentinels detect that case.
					this.context.fillStyle = '#010203';
					this.context.fillStyle = opaqueValue;
					const accepted = this.context.fillStyle;
					this.context.fillStyle = '#040506';
					this.context.fillStyle = opaqueValue;
					if (accepted !== this.context.fillStyle) {
						this.cache.set(value, null);
						return null;
					}
					this.context.fillRect(0, 0, 1, 1);
					const [r, g, b, a] = this.context.getImageData(
						0,
						0,
						1,
						1,
					).data;
					if (
						r !== undefined &&
						g !== undefined &&
						b !== undefined &&
						a !== undefined
					)
						color = {
							r: r / 255,
							g: g / 255,
							b: b / 255,
							a:
								exactAlpha === null
									? a / 255
									: Math.max(0, Math.min(1, exactAlpha)),
						};
				}
			} catch {
				// A missing or restricted canvas cannot establish a contrast pass.
			}
		}
		if (this.cache.size >= 256) this.cache.clear();
		this.cache.set(value, color);
		return color;
	}
}
