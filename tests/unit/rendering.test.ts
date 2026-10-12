import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Appearance } from '../../src/adapters/appearance';
import { HostDecorationController } from '../../src/adapters/controller';
import { RenderingPipeline } from '../../src/adapters/rendering';
import { ColorEngine } from '../../src/color/engine';
import { CssColors } from '../../src/adapters/css-colors';
import { SurfaceReader } from '../../src/adapters/surfaces';
import { resolveTestColor } from '../fixtures/colors';
import {
	createExplorer,
	createTabs,
	ManualFrames,
	setHostStyles,
} from '../fixtures/dom';
import { installObsidianDom } from '../fixtures/dom-support';

let restoreDom: () => void;
const cleanups: (() => void)[] = [];
beforeEach(() => {
	restoreDom = installObsidianDom();
	document.body.className = 'theme-dark';
	setHostStyles(document.body, { 'background-color': '#282828' });
});
afterEach(() => {
	for (const cleanup of cleanups.splice(0)) cleanup();
	vi.restoreAllMocks();
	document.body.replaceChildren();
	document.body.removeAttribute('class');
	document.body.removeAttribute('style');
	restoreDom();
});

/** Render paths in one Explorer batch; the retained controller is always disposed after assertions. */
function host(paths: readonly string[]) {
	const explorer = createExplorer();
	const rows = paths.map((path) => explorer.row(path));
	const frames = new ManualFrames();
	const controller = new HostDecorationController(
		() => ({ explorerRoots: [explorer.root], tabs: [] }),
		resolveTestColor,
		frames,
	);
	cleanups.push(() => controller.dispose());
	controller.start();
	frames.run();
	return { explorer, rows, controller, frames };
}

describe('rendering work bounds', () => {
	it('ignores a covered ancestor image while still rejecting its opacity and filters', () => {
		const explorer = createExplorer();
		setHostStyles(explorer.root, {
			'background-image': 'linear-gradient(red, blue)',
		});
		const row = explorer.row('Projects/Note.md', 'file', {
			'background-color': '#ffffff',
		});
		const colors = new CssColors(document);
		expect(new SurfaceReader(colors).read(row)).toEqual({
			r: 1,
			g: 1,
			b: 1,
			a: 1,
		});
		setHostStyles(explorer.root, { opacity: '0.9' });
		expect(new SurfaceReader(colors).read(row)).toBeNull();
		setHostStyles(explorer.root, { opacity: '1', filter: 'blur(1px)' });
		expect(new SurfaceReader(colors).read(row)).toBeNull();
	});

	it('reads shared backdrop colors once per batch and sees changes in the next batch', () => {
		const explorer = createExplorer();
		setHostStyles(explorer.root, { 'background-color': '#102030' });
		const rows = ['First', 'Second', 'Third'].map((name) =>
			explorer.row(`Projects/${name}.md`),
		);
		const colors = new CssColors(document);
		const parse = vi.spyOn(colors, 'read');
		const reader = new SurfaceReader(colors);
		for (const row of rows)
			expect(reader.read(row)).toEqual({
				r: 16 / 255,
				g: 32 / 255,
				b: 48 / 255,
				a: 1,
			});
		expect(
			parse.mock.calls.filter(([value]) => value === 'rgb(16, 32, 48)'),
		).toHaveLength(1);
		setHostStyles(explorer.root, { 'background-color': '#ffffff' });
		expect(new SurfaceReader(colors).read(rows[0]!)).toEqual({
			r: 1,
			g: 1,
			b: 1,
			a: 1,
		});
	});

	it('keeps adaptation and final verification reads free of intervening foreground writes', () => {
		const explorer = createExplorer();
		explorer.row('Projects/First.md');
		explorer.row('Projects/Second.md');
		const tab = createTabs().header();
		const frames = new ManualFrames();
		const controller = new HostDecorationController(
			() => ({
				explorerRoots: [explorer.root],
				tabs: [{ element: tab, filePath: 'Projects/First.md' }],
			}),
			resolveTestColor,
			frames,
		);
		cleanups.push(() => controller.dispose());
		controller.start();
		frames.run();
		const observer = new MutationObserver(() => {});
		observer.observe(document.body, { attributes: true, subtree: true });
		cleanups.push(() => observer.disconnect());
		const computedStyle = window.getComputedStyle.bind(window);
		let measured = false;
		let writesBetweenReads = 0;
		let committedWrites = 0;
		let phases = 0;
		const begin = vi.spyOn(RenderingPipeline.prototype, 'begin');
		vi.spyOn(window, 'getComputedStyle').mockImplementation((element) => {
			const writes = observer.takeRecords();
			const current = begin.mock.calls.length;
			if (current === phases) writesBetweenReads += writes.length;
			else if (current === 2) committedWrites += writes.length;
			phases = current;
			measured = true;
			return computedStyle(element);
		});
		setHostStyles(document.body, { 'background-color': '#8b6cef' });
		observer.takeRecords();
		controller.requestRefresh();
		frames.run();
		expect(measured).toBe(true);
		expect(phases).toBe(2);
		expect(committedWrites).toBeGreaterThan(0);
		expect(writesBetweenReads).toBe(0);
	});

	it('leaves unchanged neutral glyphs without attribute mutations', () => {
		const { explorer, rows, controller, frames } = host([
			'Neutral/Note.md',
		]);
		const icon = rows[0]?.querySelector('.cfft-type-icon');
		const observer = new MutationObserver(() => {});
		observer.observe(explorer.root, {
			attributes: true,
			childList: true,
			subtree: true,
		});
		cleanups.push(() => observer.disconnect());
		controller.requestRefresh();
		frames.run();
		expect(observer.takeRecords()).toHaveLength(0);
		expect(rows[0]?.querySelector('.cfft-type-icon')).toBe(icon);
	});

	it('measures only enabled foreground channels and skips fully disabled surfaces', () => {
		const { rows } = host(['Projects/Note.md']);
		const row = rows[0]!;
		const identity = resolveTestColor({
			path: 'Projects/Note.md',
			kind: 'file',
		})!;
		let preferences = { text: false, icons: true, tabs: false };
		const pipeline = new RenderingPipeline(
			() => {},
			() => preferences,
		);
		cleanups.push(() => pipeline.dispose());
		const context = vi.spyOn(Appearance.prototype, 'context');
		const render = vi.spyOn(ColorEngine.prototype, 'render');
		expect(pipeline.render(identity, row, 'file')?.icon).not.toBeNull();
		expect(render.mock.calls.map((call) => call[3])).toEqual(['icon']);
		expect(context.mock.calls.map(([element]) => element)).toEqual([
			row.querySelector('.cfft-type-icon'),
		]);
		context.mockClear();
		render.mockClear();
		preferences = { text: true, icons: false, tabs: false };
		expect(pipeline.render(identity, row, 'file')?.text).not.toBeNull();
		expect(render.mock.calls.map((call) => call[3])).toEqual(['text']);
		context.mockClear();
		render.mockClear();
		preferences = { text: false, icons: false, tabs: false };
		expect(pipeline.render(identity, row, 'file')).toBeNull();
		expect(pipeline.render(identity, row, 'tab')).toBeNull();
		expect(context).not.toHaveBeenCalled();
		expect(render).not.toHaveBeenCalled();
	});
});
