import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { ExplorerAdapter } from '../../src/adapters/explorer';
import { resolveTestColor } from '../fixtures/colors';
import { createExplorer } from '../fixtures/dom';
import { installObsidianDom } from '../fixtures/dom-support';

let restoreDom: () => void;
const adapters: ExplorerAdapter[] = [];
beforeEach(() => {
	restoreDom = installObsidianDom();
});
afterEach(() => {
	for (const adapter of adapters.splice(0)) adapter.dispose();
	document.body.replaceChildren();
	restoreDom();
});

/** Track an injected adapter so failed assertions still release its observers. */
function track(adapter: ExplorerAdapter): ExplorerAdapter {
	adapters.push(adapter);
	return adapter;
}

describe('Explorer decoration', () => {
	it('colors Projects and its rendered descendants using the supplied vault layout', () => {
		const explorer = createExplorer();
		const rows = [
			explorer.row('Home.md'),
			explorer.row('Projects', 'folder'),
			explorer.row('Projects/Projects.md'),
			explorer.row('Projects/Project-Alpha', 'folder'),
			explorer.row('Projects/Project-Alpha/README.md'),
			explorer.row('Projects/Project-Beta/README.md'),
			explorer.row('Work/Work.md'),
			explorer.row('Personal/Notes/Test-Note.md'),
			explorer.row('Archive', 'folder'),
			explorer.row('Projects-other', 'folder'),
		];
		const adapter = track(new ExplorerAdapter(resolveTestColor, () => {}));
		adapter.refresh([explorer.root]);
		expect(
			rows
				.filter((row) => row.classList.contains('cfft-explorer-color'))
				.map((row) => row.getAttribute('data-path')),
		).toEqual([
			'Projects',
			'Projects/Projects.md',
			'Projects/Project-Alpha',
			'Projects/Project-Alpha/README.md',
			'Projects/Project-Beta/README.md',
		]);
	});

	it('clears recycled rows and handles renamed identities without altering host state', () => {
		const explorer = createExplorer();
		const row = explorer.row('Projects/Project-Alpha/README.md', 'file', {
			color: 'red',
			'background-color': 'black',
		});
		row.classList.add('is-active');
		row.setAttribute('aria-current', 'true');
		const originalChildren = [...row.childNodes];
		row.focus();
		const adapter = track(new ExplorerAdapter(resolveTestColor, () => {}));
		adapter.refresh([explorer.root]);
		row.setAttribute('data-path', 'Work/Meetings/Meeting-Notes.md');
		adapter.refresh([explorer.root]);
		expect(row.classList.contains('cfft-explorer-color')).toBe(false);
		expect(row.matches('.cfft-explorer-color, .cfft-tab-color')).toBe(
			false,
		);
		expect(row.classList.contains('is-active')).toBe(true);
		expect(row.getAttribute('aria-current')).toBe('true');
		expect(row.style.color).toBe('red');
		expect(row.style.backgroundColor).toBe('black');
		expect(
			[...row.childNodes].filter(
				(node) => node !== row.querySelector('.cfft-type-icon'),
			),
		).toEqual(originalChildren);
		expect(
			row.querySelector('.cfft-type-icon .lucide-file-text'),
		).not.toBeNull();
		expect(document.activeElement).toBe(row);
		row.setAttribute('data-path', 'Projects/Project-Alpha/Renamed.md');
		adapter.refresh([explorer.root]);
		expect(row.matches('.cfft-explorer-color, .cfft-tab-color')).toBe(true);
		adapter.dispose();
		expect([...row.childNodes]).toEqual(originalChildren);
	});

	it('ignores absent structures, unrelated data-path nodes, and invalid paths', () => {
		const explorer = createExplorer();
		const adapter = track(new ExplorerAdapter(resolveTestColor, () => {}));
		expect(() => adapter.refresh([])).not.toThrow();
		const unrelated = document.createElement('div');
		unrelated.setAttribute('data-path', 'Projects/Projects.md');
		explorer.root.append(unrelated);
		for (const path of [
			'/Projects/README.md',
			'Projects/../Home.md',
			'Projects//README.md',
			'Projects\\README.md',
			'',
		]) {
			explorer.row(path);
		}
		adapter.refresh([explorer.root]);
		expect(
			explorer.root.querySelectorAll('.cfft-explorer-color'),
		).toHaveLength(0);
	});

	it('fails neutral for invalid or throwing resolvers and continues with supported rows', () => {
		const explorer = createExplorer();
		const failed = explorer.row('Projects/Failed.md');
		const invalid = explorer.row('Projects/Invalid.md');
		const valid = explorer.row('Projects/Valid.md');
		const adapter = track(
			new ExplorerAdapter(
				({ path }) => {
					if (path.endsWith('Failed.md'))
						throw new Error('Unsupported identity');
					const identity = resolveTestColor({ path, kind: 'file' });
					return path.endsWith('Invalid.md') && identity
						? {
								...identity,
								color: { ...identity.color, seed: '#invalid' },
							}
						: identity;
				},
				() => {},
			),
		);
		expect(() => adapter.refresh([explorer.root])).not.toThrow();
		expect(failed.matches('.cfft-explorer-color, .cfft-tab-color')).toBe(
			false,
		);
		expect(invalid.matches('.cfft-explorer-color, .cfft-tab-color')).toBe(
			false,
		);
		expect(valid.matches('.cfft-explorer-color, .cfft-tab-color')).toBe(
			true,
		);
	});
});
