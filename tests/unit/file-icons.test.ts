import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { ExplorerAdapter } from '../../src/adapters/explorer';
import { fileTypeIcon } from '../../src/adapters/file-icons';
import { TabAdapter } from '../../src/adapters/tabs';
import { resolveTestColor } from '../fixtures/colors';
import { createExplorer, createTabs } from '../fixtures/dom';
import { installObsidianDom } from '../fixtures/dom-support';

let restoreDom: () => void;
const cleanups: (() => void)[] = [];
beforeEach(() => {
	restoreDom = installObsidianDom();
});
afterEach(() => {
	for (const cleanup of cleanups.splice(0)) cleanup();
	document.body.replaceChildren();
	restoreDom();
});

describe('semantic native file icons', () => {
	it.each([
		['Note.md', 'file-text'],
		['Document.PDF', 'file-text'],
		['Letter.docx', 'file-text'],
		['Picture.PNG', 'image'],
		['Drawing.svg', 'image'],
		['Recording.m4a', 'audio-lines'],
		['Song.flac', 'audio-lines'],
		['Clip.mp4', 'video'],
		['Clip.webm', 'video'],
		['Board.canvas', 'layout-dashboard'],
		['Collection.base', 'database'],
		['Table.csv', 'database'],
		['Plugin.custom', 'file'],
		['Archive.tar.gz', 'file'],
		['No extension', 'file'],
		['.hidden', 'file'],
	])('uses %s as %s in any ancestor folder', (filename, icon) => {
		expect(
			fileTypeIcon({ path: `Pictures.jpg/${filename}`, kind: 'file' }),
		).toBe(icon);
	});

	it('uses the folder silhouette regardless of its name or extension', () => {
		expect(
			fileTypeIcon({ path: 'Folders/Board.canvas', kind: 'folder' }),
		).toBe('folder');
	});

	it('adds neutral and inherited icons beside Explorer labels without touching disclosure arrows or focus', () => {
		const explorer = createExplorer();
		const folder = explorer.row('Projects', 'folder');
		const file = explorer.row('Projects/Picture.png');
		const neutral = explorer.row('Home.md');
		const arrow = document.createElement('span');
		arrow.className = 'tree-item-icon collapse-icon';
		arrow.textContent = 'Native arrow';
		folder.prepend(arrow);
		const adapter = new ExplorerAdapter(resolveTestColor, () => {});
		cleanups.push(() => adapter.dispose());
		file.focus();
		adapter.refresh([explorer.root]);
		const glyph = file.querySelector('.cfft-type-icon');
		expect(
			folder.querySelector('.cfft-type-icon .lucide-folder'),
		).not.toBeNull();
		expect(
			file.querySelector('.cfft-type-icon .lucide-image'),
		).not.toBeNull();
		expect(
			neutral.querySelector('.cfft-type-icon .lucide-file-text'),
		).not.toBeNull();
		expect(neutral.classList.contains('cfft-explorer-color')).toBe(false);
		expect(glyph?.getAttribute('aria-hidden')).toBe('true');
		expect(glyph?.hasAttribute('tabindex')).toBe(false);
		expect(
			glyph?.nextElementSibling?.matches('.nav-file-title-content'),
		).toBe(true);
		expect(folder.firstChild).toBe(arrow);
		expect(arrow.textContent).toBe('Native arrow');
		expect(document.activeElement).toBe(file);
		adapter.refresh([explorer.root]);
		expect(file.querySelectorAll('.cfft-type-icon')).toHaveLength(1);
		expect(file.querySelector('.cfft-type-icon')).toBe(glyph);
		file.setAttribute('data-path', 'Projects/Recording.mp3');
		adapter.refresh([explorer.root]);
		expect(file.querySelector('.cfft-type-icon')).toBe(glyph);
		expect(
			file.querySelector('.cfft-type-icon .lucide-audio-lines'),
		).not.toBeNull();
		file.setAttribute('data-path', '../Invalid.md');
		adapter.refresh([explorer.root]);
		expect(file.querySelector('.cfft-type-icon')).toBeNull();
	});

	it('keeps current native tab glyphs intact through recycling and unload, including neutral animation clones', () => {
		const tabs = createTabs();
		const header = tabs.header('Picture');
		const native = header.querySelector(
			'.workspace-tab-header-inner-icon',
		)!;
		const adapter = new TabAdapter(resolveTestColor, () => {});
		cleanups.push(() => adapter.dispose());
		adapter.refresh([{ element: header, filePath: 'Home.png' }]);
		expect(
			header.querySelector('.cfft-type-icon .lucide-image'),
		).not.toBeNull();
		expect(native.textContent).toBe('Native icon');
		// The host may update its own glyph before reusing the header for a non-file view.
		native.textContent = 'Current graph icon';
		adapter.refresh([{ element: header, filePath: null }]);
		expect(header.querySelector('.cfft-type-icon')).toBeNull();
		expect(header.classList.contains('cfft-tab-icons')).toBe(false);
		expect(header.querySelector('.workspace-tab-header-inner-icon')).toBe(
			native,
		);
		expect(native.textContent).toBe('Current graph icon');
		adapter.refresh([{ element: header, filePath: 'Collection.base' }]);
		expect(
			header.querySelector('.cfft-type-icon .lucide-database'),
		).not.toBeNull();
		const clone = header.cloneNode(true) as HTMLElement;
		header.after(clone);
		adapter.dispose();
		expect(
			tabs.root.querySelectorAll('.cfft-type-icon, .cfft-tab-icons'),
		).toHaveLength(0);
		expect(native.textContent).toBe('Current graph icon');
		expect(
			clone.querySelector('.workspace-tab-header-inner-icon')
				?.textContent,
		).toBe('Current graph icon');
	});

	it('leaves unsupported native label structures intact', () => {
		const tabs = createTabs();
		const header = tabs.header();
		header.querySelector('.workspace-tab-header-inner-title')?.remove();
		const original = header.innerHTML;
		const adapter = new TabAdapter(resolveTestColor, () => {});
		cleanups.push(() => adapter.dispose());
		adapter.refresh([{ element: header, filePath: 'Home.md' }]);
		expect(header.innerHTML).toBe(original);
		expect(header.classList.contains('cfft-tab-icons')).toBe(false);
	});
});
