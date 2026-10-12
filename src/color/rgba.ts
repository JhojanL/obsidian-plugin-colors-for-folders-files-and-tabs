/** Encoded sRGB channels and alpha, each in the inclusive range 0–1. */
export interface Rgba {
	readonly r: number;
	readonly g: number;
	readonly b: number;
	readonly a: number;
}

/** Accept color only when every encoded channel and alpha is finite and in range. */
export function validRgba(color: Rgba): boolean {
	return [color.r, color.g, color.b, color.a].every(
		(value) => Number.isFinite(value) && value >= 0 && value <= 1,
	);
}

/** Decode value as hex, transparent, black/white, or CSS rgb(a); unsupported syntax stays unknown. */
export function parseColor(value: string): Rgba | null {
	const input = value.trim().toLowerCase();
	if (input === 'transparent') return { r: 0, g: 0, b: 0, a: 0 };
	if (input === 'black') return { r: 0, g: 0, b: 0, a: 1 };
	if (input === 'white') return { r: 1, g: 1, b: 1, a: 1 };
	if (/^#(?:[\da-f]{3,4}|[\da-f]{6}|[\da-f]{8})$/.test(input)) {
		let hex = input.slice(1);
		if (hex.length <= 4)
			hex = [...hex].map((digit) => digit + digit).join('');
		return {
			r: parseInt(hex.slice(0, 2), 16) / 255,
			g: parseInt(hex.slice(2, 4), 16) / 255,
			b: parseInt(hex.slice(4, 6), 16) / 255,
			a: hex.length === 8 ? parseInt(hex.slice(6, 8), 16) / 255 : 1,
		};
	}
	const match = /^rgba?\(([^()]+)\)$/.exec(input);
	if (!match?.[1]) return null;
	const syntax = match[1];
	let parts: string[];
	if (syntax.includes(',')) {
		if (syntax.includes('/')) return null;
		parts = syntax.split(',').map((part) => part.trim());
	} else {
		const [rgb = '', alpha, extra] = syntax.split('/');
		if (extra !== undefined) return null;
		parts = rgb.trim().split(/\s+/);
		if (parts.length !== 3) return null;
		if (alpha !== undefined) parts.push(alpha.trim());
	}
	if (parts.length < 3 || parts.length > 4) return null;
	const channels = parts.map((part, index) => {
		if (!/^[+-]?(?:\d+(?:\.\d*)?|\.\d+)%?$/.test(part)) return NaN;
		return (
			parseFloat(part) / (part.endsWith('%') ? 100 : index < 3 ? 255 : 1)
		);
	});
	const [r = NaN, g = NaN, b = NaN, a = 1] = channels;
	const color = { r, g, b, a };
	return validRgba(color) ? color : null;
}

/** Composite foreground over background using source-over in encoded sRGB; invalid inputs return null. */
export function composite(foreground: Rgba, background: Rgba): Rgba | null {
	if (!validRgba(foreground) || !validRgba(background)) return null;
	const a = foreground.a + background.a * (1 - foreground.a);
	if (a === 0) return { r: 0, g: 0, b: 0, a: 0 };
	const channel = (front: number, back: number): number =>
		(front * foreground.a + back * background.a * (1 - foreground.a)) / a;
	return {
		r: channel(foreground.r, background.r),
		g: channel(foreground.g, background.g),
		b: channel(foreground.b, background.b),
		a,
	};
}

/** Convert opaque color to a validated six-digit hex value; alpha or invalid channels return null. */
export function toHex(color: Rgba): `#${string}` | null {
	if (!validRgba(color) || color.a !== 1) return null;
	return `#${[color.r, color.g, color.b]
		.map((channel) =>
			Math.round(channel * 255)
				.toString(16)
				.padStart(2, '0'),
		)
		.join('')}`;
}

/** Linearize an encoded sRGB channel in the range 0–1 for luminance and color-space conversion. */
export function linearChannel(channel: number): number {
	return channel <= 0.04045
		? channel / 12.92
		: ((channel + 0.055) / 1.055) ** 2.4;
}

/** Encode a linear sRGB channel; out-of-gamut values remain out of range for gamut testing. */
export function encodedChannel(channel: number): number {
	return channel <= 0.0031308
		? 12.92 * channel
		: 1.055 * channel ** (1 / 2.4) - 0.055;
}
