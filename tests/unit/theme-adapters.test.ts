import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { HostDecorationController } from '../../src/adapters/controller';
import { CssColors } from '../../src/adapters/css-colors';
import { SurfaceReader } from '../../src/adapters/surfaces';
import type { ColorResolver } from '../../src/adapters/contracts';
import { readSettings } from '../../src/model/settings';
import { SettingsStore } from '../../src/settings/store';
import { resolveTestColor } from '../fixtures/colors';
import {
	createExplorer,
	createTabs,
	ManualFrames,
	setHostStyles,
} from '../fixtures/dom';
import { MemorySettings } from '../fixtures/settings';
import { installObsidianDom } from '../fixtures/dom-support';

let restoreDom: () => void;
const cleanups: (() => void)[] = [];
beforeEach(() => {
	restoreDom = installObsidianDom();
});
afterEach(() => {
	for (const cleanup of cleanups.splice(0)) cleanup();
	vi.restoreAllMocks();
	document.body.replaceChildren();
	document.body.removeAttribute('class');
	document.body.removeAttribute('style');
	restoreDom();
});

/** Create measured rows/tabs using resolver's synthetic assignments, retaining cleanup even if assertions fail. */
function host(resolver: ColorResolver = resolveTestColor) {
	document.body.className = 'theme-dark';
	setHostStyles(document.body, { 'background-color': '#282828' });
	const explorer = createExplorer();
	const folder = explorer.row('Projects', 'folder');
	const file = explorer.row('Projects/Note.md');
	const arrow = document.createElement('span');
	arrow.className = 'nav-folder-collapse-indicator';
	folder.prepend(arrow);
	const tab = createTabs().header();
	const frames = new ManualFrames();
	let preferences = { text: true, icons: true, tabs: true };
	const controller = new HostDecorationController(
		() => ({
			explorerRoots: [explorer.root],
			tabs: [{ element: tab, filePath: 'Projects/Note.md' }],
		}),
		resolver,
		frames,
		() => preferences,
	);
	cleanups.push(() => controller.dispose());
	controller.start();
	frames.run();
	return {
		folder,
		file,
		tab,
		arrow,
		icon: folder.querySelector<HTMLElement>('.cfft-type-icon')!,
		controller,
		frames,
		preferences: (value: typeof preferences) => {
			preferences = value;
			controller.requestRefresh();
			frames.run();
		},
	};
}

/** Compare an opaque foreground hex with a measured background rgb value using an independent WCAG oracle. */
function measuredContrast(foreground: string, background: string): number {
	/** Calculate opaque luminance from channels' 0–255 sRGB components. */
	const luminance = (channels: readonly number[]): number =>
		channels.reduce((sum, channel, index) => {
			const value = channel / 255;
			const linear =
				value <= 0.04045
					? value / 12.92
					: ((value + 0.055) / 1.055) ** 2.4;
			return sum + linear * [0.2126, 0.7152, 0.0722][index]!;
		}, 0);
	const front = luminance(
		[1, 3, 5].map((offset) =>
			parseInt(foreground.slice(offset, offset + 2), 16),
		),
	);
	const back = luminance(
		background
			.match(/[\d.]+/g)!
			.slice(0, 3)
			.map(Number),
	);
	return (Math.max(front, back) + 0.05) / (Math.min(front, back) + 0.05);
}

/** Model host background rules in cascade order from live selectors; real CSS is verified in ColorsTest. */
function surfaceBackgrounds(
	rules: readonly (readonly [selector: string, background: string])[],
): void {
	const computedStyle = window.getComputedStyle.bind(window);
	vi.spyOn(window, 'getComputedStyle').mockImplementation((element) => {
		const native = computedStyle(element);
		let background: string | null = null;
		for (const [selector, color] of rules)
			if (element.matches(selector)) background = color;
		if (!background) return native;
		const style = document.createElement('div').style;
		style.cssText = native.cssText;
		style.backgroundColor = background;
		return style;
	});
}

describe('measured surface and appearance integration', () => {
	it('meets contrast on backgrounds selected by presentation classes across Explorer and tabs', async () => {
		surfaceBackgrounds([
			[
				'.nav-folder-title, .nav-file-title, .workspace-tab-header',
				'#202328',
			],
			[
				'body:has(.workspace-tab-header.cfft-icon-color) .nav-folder-title, body:has(.workspace-tab-header.cfft-icon-color) .nav-file-title, body:has(.nav-folder-title.cfft-text-color) .workspace-tab-header',
				'#24272c',
			],
		]);
		const { folder, file, tab, controller, frames, preferences } = host(
			(target) => {
				const identity = resolveTestColor(target);
				return (
					identity && {
						...identity,
						color: { id: 'red', name: 'Red', seed: '#fb464c' },
					}
				);
			},
		);
		for (const element of [folder, file, tab]) {
			const background = getComputedStyle(element).backgroundColor;
			expect(background).toBe('rgb(36, 39, 44)');
			if (element !== tab)
				expect(
					measuredContrast(
						element.style.getPropertyValue('--cfft-text'),
						background,
					),
				).toBeGreaterThanOrEqual(4.5);
			expect(
				measuredContrast(
					element.style.getPropertyValue('--cfft-icon'),
					background,
				),
			).toBeGreaterThanOrEqual(3);
		}
		const initial = folder.style.getPropertyValue('--cfft-text');
		controller.requestRefresh();
		frames.run();
		expect(folder.style.getPropertyValue('--cfft-text')).toBe(initial);
		preferences({ text: false, icons: true, tabs: true });
		expect(folder.classList.contains('cfft-text-color')).toBe(false);
		expect(folder.style.getPropertyValue('--cfft-text')).toBe('');
		expect(getComputedStyle(tab).backgroundColor).toBe('rgb(32, 35, 40)');
		expect(
			measuredContrast(
				tab.style.getPropertyValue('--cfft-icon'),
				getComputedStyle(tab).backgroundColor,
			),
		).toBeGreaterThanOrEqual(3);
		await Promise.resolve();
		expect(frames.pending).toBe(0);
	});

	it('restores native foregrounds across the document when committed properties make a surface unsafe', async () => {
		surfaceBackgrounds([
			[
				'.nav-folder-title, .nav-file-title, .workspace-tab-header',
				'#202328',
			],
			['.nav-folder-title[style*="--cfft-text"]', '#ffffff'],
		]);
		const { folder, file, tab, frames } = host();
		for (const element of [folder, file, tab]) {
			expect(element.style.getPropertyValue('--cfft-text')).toBe('');
			expect(element.style.getPropertyValue('--cfft-icon')).toBe('');
			expect(element.matches('.cfft-text-color, .cfft-icon-color')).toBe(
				false,
			);
			expect(element.querySelector('.cfft-type-icon')).not.toBeNull();
		}
		await Promise.resolve();
		expect(frames.pending).toBe(0);
	});

	it('keeps a feedback fallback in its owning document and preserves the other document', () => {
		surfaceBackgrounds([
			['.nav-folder-title[style*="--cfft-text"]', '#ffffff'],
		]);
		const frame = document.createElement('iframe');
		document.body.append(frame);
		const popout = frame.contentDocument!;
		for (const doc of [document, popout]) {
			doc.body.className = 'theme-dark';
			setHostStyles(doc.body, { 'background-color': '#202328' });
		}
		const main = createExplorer();
		const mainRow = main.row('Projects', 'folder');
		const separate = createExplorer(popout);
		const separateRow = separate.row('Projects', 'folder');
		const frames = new ManualFrames();
		const controller = new HostDecorationController(
			() => ({ explorerRoots: [main.root, separate.root], tabs: [] }),
			resolveTestColor,
			frames,
			() => ({ text: true, icons: true, tabs: true }),
		);
		cleanups.push(() => controller.dispose());
		controller.start();
		frames.run();
		expect(mainRow.style.getPropertyValue('--cfft-text')).toBe('');
		expect(mainRow.style.getPropertyValue('--cfft-icon')).toBe('');
		expect(separateRow.style.getPropertyValue('--cfft-text')).toMatch(
			/^#[\da-f]{6}$/,
		);
		expect(separateRow.style.getPropertyValue('--cfft-icon')).toMatch(
			/^#[\da-f]{6}$/,
		);
	});

	it('adapts transparent glyphs with host opacity while leaving row/group opacity to the fallback', () => {
		const { folder, icon, controller, frames } = host();
		setHostStyles(icon, { opacity: '0.85' });
		controller.requestRefresh();
		frames.run();
		expect(folder.style.getPropertyValue('--cfft-icon')).not.toBe('');
		expect(icon.style.opacity).toBe('0.85');
		setHostStyles(folder, { opacity: '0.85' });
		controller.requestRefresh();
		frames.run();
		expect(folder.style.getPropertyValue('--cfft-icon')).toBe('');
		expect(folder.style.getPropertyValue('--cfft-text')).toBe('');
	});
	it('composites actual transparent element/ancestor surfaces and refuses an unknown backdrop', () => {
		setHostStyles(document.body, { 'background-color': '#000000' });
		const row = createExplorer().row('Projects', 'folder', {
			'background-color': 'rgba(255,255,255,0.5)',
		});
		const reader = new SurfaceReader(new CssColors(document));
		expect(reader.read(row)).toEqual({ r: 0.5, g: 0.5, b: 0.5, a: 1 });
		setHostStyles(document.body, { 'background-color': 'transparent' });
		expect(new SurfaceReader(new CssColors(document)).read(row)).toBeNull();
	});

	it('measures text and icon child surfaces separately and preserves host focus/selection/controls', () => {
		const { folder, file, tab, icon, arrow, controller, frames } = host();
		for (const element of [folder, file])
			expect(element.style.getPropertyValue('--cfft-text')).toMatch(
				/^#[\da-f]{6}$/,
			);
		expect(tab.style.getPropertyValue('--cfft-text')).toBe('');
		expect(tab.style.getPropertyValue('--cfft-icon')).toBe(
			folder.style.getPropertyValue('--cfft-icon'),
		);
		expect(file.style.getPropertyValue('--cfft-icon')).not.toBe(
			folder.style.getPropertyValue('--cfft-icon'),
		);
		const title = folder.querySelector<HTMLElement>(
			'.nav-folder-title-content',
		);
		if (!title) throw new Error('Missing fixture title');
		const initial = folder.style.getPropertyValue('--cfft-text');
		setHostStyles(title, { 'background-color': '#ffffff' });
		setHostStyles(icon, { 'background-color': '#8b6cef' });
		folder.classList.add('is-selected');
		folder.setAttribute('aria-selected', 'true');
		setHostStyles(folder, { outline: '2px solid red' });
		folder.focus();
		controller.requestRefresh();
		frames.run();
		expect(folder.style.getPropertyValue('--cfft-text')).not.toBe(initial);
		expect(folder.style.getPropertyValue('--cfft-icon')).not.toBe(
			tab.style.getPropertyValue('--cfft-icon'),
		);
		expect(folder.style.outline).toBe('2px solid red');
		expect(folder.getAttribute('aria-selected')).toBe('true');
		expect(document.activeElement).toBe(folder);
		expect(tab.querySelector('button')?.getAttribute('aria-label')).toBe(
			'Close tab',
		);
		expect(folder.style.opacity).toBe('');
		expect(arrow.style.color).toBe('');
	});

	it('refreshes on Obsidian mode changes and host CSS changes without requiring OS preference events', async () => {
		const { folder, frames, controller } = host();
		await Promise.resolve();
		expect(frames.pending).toBe(0);
		const dark = folder.style.getPropertyValue('--cfft-text');
		document.body.className = 'theme-light';
		setHostStyles(document.body, { 'background-color': '#ffffff' });
		await Promise.resolve();
		expect(frames.pending).toBe(1);
		frames.run();
		expect(folder.style.getPropertyValue('--cfft-text')).not.toBe(dark);
		const light = folder.style.getPropertyValue('--cfft-text');
		setHostStyles(document.body, { 'background-color': '#201a37' });
		controller.invalidateAppearance();
		frames.run();
		expect(folder.style.getPropertyValue('--cfft-text')).not.toBe(light);
		await Promise.resolve();
		frames.run();
		await Promise.resolve();
		expect(frames.pending).toBe(0);
	});

	it('re-evaluates hover/focus interactions and removes interaction and appearance listeners on unload', async () => {
		const { folder, frames, controller } = host();
		await Promise.resolve();
		for (const event of [
			'pointerover',
			'pointerout',
			'focusin',
			'focusout',
		]) {
			folder.dispatchEvent(new Event(event, { bubbles: true }));
			expect(frames.pending).toBe(1);
			frames.run();
		}
		controller.dispose();
		for (const event of [
			'pointerover',
			'pointerout',
			'focusin',
			'focusout',
		])
			folder.dispatchEvent(new Event(event, { bubbles: true }));
		document.body.className = 'theme-light';
		await Promise.resolve();
		expect(frames.pending).toBe(0);
		for (const property of ['--cfft-text', '--cfft-icon'])
			expect(folder.style.getPropertyValue(property)).toBe('');
	});

	it.each(['opacity', 'filter', 'background-image'] as const)(
		'preserves host text when %s prevents a reliable surface evaluation',
		(property) => {
			const { folder, frames, controller } = host();
			folder.style.setProperty(
				property,
				property === 'opacity'
					? '0.8'
					: property === 'filter'
						? 'blur(1px)'
						: 'linear-gradient(red, blue)',
			);
			controller.requestRefresh();
			frames.run();
			expect(folder.style.getPropertyValue('--cfft-text')).toBe('');
			expect(folder.style.getPropertyValue('--cfft-icon')).toBe('');
			if (property === 'background-image') {
				expect(folder.style.backgroundImage).toBe(
					'linear-gradient(red, blue)',
				);
			}
			expect(
				folder.querySelector('.cfft-type-icon .lucide-folder'),
			).not.toBeNull();
		},
	);

	it('controls Explorer names/icons and tab icons independently, keeping native tab names', () => {
		const { folder, tab, preferences } = host();
		preferences({ text: false, icons: true, tabs: true });
		expect(folder.style.getPropertyValue('--cfft-text')).toBe('');
		expect(folder.style.getPropertyValue('--cfft-icon')).not.toBe('');
		expect(tab.style.getPropertyValue('--cfft-text')).toBe('');
		expect(tab.style.getPropertyValue('--cfft-icon')).not.toBe('');
		preferences({ text: true, icons: false, tabs: true });
		expect(folder.style.getPropertyValue('--cfft-text')).not.toBe('');
		expect(folder.style.getPropertyValue('--cfft-icon')).toBe('');
		expect(tab.style.getPropertyValue('--cfft-icon')).not.toBe('');
		preferences({ text: true, icons: true, tabs: false });
		expect(folder.style.getPropertyValue('--cfft-icon')).not.toBe('');
		expect(tab.classList.contains('cfft-tab-color')).toBe(false);
		for (const property of ['--cfft-text', '--cfft-icon'])
			expect(tab.style.getPropertyValue(property)).toBe('');
		expect(
			tab.querySelector('.cfft-type-icon .lucide-file-text'),
		).not.toBeNull();
		preferences({ text: false, icons: false, tabs: true });
		expect(folder.style.getPropertyValue('--cfft-icon')).toBe('');
		expect(tab.style.getPropertyValue('--cfft-icon')).not.toBe('');
	});
});

describe('coloring preference persistence', () => {
	it('defaults existing v1 data without saving, then persists independent validated flags', async () => {
		const old = {
			schemaVersion: 1,
			palette: [{ id: 'mine', name: 'My seed', seed: '#123456' }],
			assignments: { Projects: 'mine' },
		};
		const storage = new MemorySettings(old);
		const store = new SettingsStore(storage);
		cleanups.push(() => store.dispose());
		await store.reload();
		expect(storage.saves).toHaveLength(0);
		expect(store.settings.coloring).toEqual({
			text: false,
			icons: true,
			tabs: true,
		});
		await store.setColoring('text', false);
		await store.setColoring('tabs', false);
		expect(store.settings.coloring).toEqual({
			text: false,
			icons: true,
			tabs: false,
		});
		expect(store.settings.palette).toEqual(old.palette);
		await store.reload();
		expect(store.settings.coloring).toEqual({
			text: false,
			icons: true,
			tabs: false,
		});
		expect(Object.isFrozen(store.settings.coloring)).toBe(true);
	});

	it.each([
		{ text: 1, icons: true, tabs: true },
		{ text: false },
		{ text: true, icons: true, tabs: true, unknown: true },
		null,
	])(
		'blocks corrupt coloring flags %j without accepting defaults as saved data',
		(coloring) => {
			expect(
				readSettings({
					schemaVersion: 1,
					palette: [],
					assignments: {},
					coloring,
				}).status,
			).toBe('invalid');
		},
	);
});
