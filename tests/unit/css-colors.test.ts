import { afterEach, describe, expect, it, vi } from 'vitest';
import { CssColors } from '../../src/adapters/css-colors';

afterEach(() => vi.unstubAllGlobals());

/** Model the browser canvas boundary: unsupported assignments leave its previous fill style intact. */
function browserColors(available = true) {
	let fillStyle = '#000000';
	const context = {
		get fillStyle() {
			return fillStyle;
		},
		set fillStyle(value: string) {
			if (/^#[\da-f]{6}$/.test(value) || value === 'oklch(1 0 none / 1)')
				fillStyle = value;
		},
		clearRect: vi.fn(),
		fillRect: vi.fn(),
		getImageData: () => ({
			data: new Uint8ClampedArray([255, 255, 255, 255]),
		}),
	};
	vi.stubGlobal('CSS', { supports: () => true });
	vi.stubGlobal('createEl', () => {
		const canvas = document.createElement('canvas');
		vi.spyOn(canvas, 'getContext').mockImplementation(() =>
			available ? (context as unknown as CanvasRenderingContext2D) : null,
		);
		return canvas;
	});
	return { reader: new CssColors(document), context };
}

describe('browser color normalization', () => {
	it('retains modern computed alpha exactly rather than quantizing it with the canvas pixel', () => {
		const { reader, context } = browserColors();
		expect(reader.read('oklch(1 0 none / 0.067)')).toEqual({
			r: 1,
			g: 1,
			b: 1,
			a: 0.067,
		});
		expect(context.fillStyle).toBe('oklch(1 0 none / 1)');
		expect(reader.read('oklch(1 0 none / 6.7%)')?.a).toBe(0.067);
	});

	it('rejects colors that CSS accepts but canvas silently ignores, even after a successful color', () => {
		const { reader } = browserColors();
		reader.read('oklch(1 0 none / 0.067)');
		expect(reader.read('unsupported-by-canvas')).toBeNull();
		expect(reader.read('unsupported-by-canvas')).toBeNull();
	});

	it.each([
		'inherit',
		'initial',
		'unset',
		'revert',
		'revert-layer',
		'currentColor',
		'light-dark(white, black)',
		'var(--color-blue)',
	])('preserves unknown for context-dependent color %s', (value) => {
		const { reader, context } = browserColors();
		expect(reader.read(value)).toBeNull();
		expect(context.fillRect).not.toHaveBeenCalled();
	});

	it('preserves unknown when a canvas is unavailable while still accepting direct sRGB', () => {
		const { reader } = browserColors(false);
		expect(reader.read('oklch(1 0 none / 0.067)')).toBeNull();
		expect(reader.read('#ffffff')).toEqual({ r: 1, g: 1, b: 1, a: 1 });
	});
});
