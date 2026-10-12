import { describe, expect, it } from 'vitest';
import {
	assignFolder,
	deleteFolder,
	moveFolder,
	putPaletteColor,
	removePaletteColor,
} from '../../src/model/changes';
import { normalizeVaultPath } from '../../src/model/paths';
import { resolveColorIdentity } from '../../src/model/resolve';
import { defaultSettings } from '../../src/model/settings';
import type { ColorSettings, ColorTarget } from '../../src/model/types';

/** Resolve path against settings as kind; file targets include their filename. */
function resolve(
	settings: ColorSettings,
	path: string,
	kind: ColorTarget['kind'] = 'file',
) {
	return resolveColorIdentity(settings, { path, kind });
}

describe('color inheritance', () => {
	it('uses the nearest explicit ancestor and reports containing-folder depth and role', () => {
		const settings = assignFolder(
			assignFolder(defaultSettings(), 'A', 'red'),
			'A/B',
			'blue',
		);
		expect(resolve(settings, 'A/B/Deep/Note.md')).toEqual({
			color: { id: 'blue', name: 'Blue', seed: '--color-blue' },
			assignedPath: 'A/B',
			relativeDepth: 1,
			role: 'file',
		});
		expect(resolve(settings, 'A/B', 'folder')).toMatchObject({
			assignedPath: 'A/B',
			relativeDepth: 0,
			role: 'folder',
		});
		expect(resolve(settings, 'A/Note.md')).toMatchObject({
			assignedPath: 'A',
			relativeDepth: 0,
		});
		expect(resolve(settings, 'A/B/Deep', 'folder')?.relativeDepth).toBe(1);
	});

	it('resumes inheritance when an override is cleared and becomes neutral without an ancestor', () => {
		const original = assignFolder(
			assignFolder(defaultSettings(), 'A', 'red'),
			'A/B',
			'blue',
		);
		const cleared = assignFolder(original, 'A/B', null);
		expect(resolve(cleared, 'A/B/Note.md')).toMatchObject({
			assignedPath: 'A',
			relativeDepth: 1,
		});
		expect(
			resolve(assignFolder(cleared, 'A', null), 'A/B/Note.md'),
		).toBeNull();
		expect(original.assignments).toEqual({ A: 'red', 'A/B': 'blue' });
	});

	it('keeps loose root files and segment-prefix siblings neutral', () => {
		const settings = assignFolder(defaultSettings(), 'A', 'red');
		for (const path of [
			'Home.md',
			'A.md',
			'AB/Note.md',
			'a/Note.md',
			'constructor/Note.md',
		])
			expect(resolve(settings, path)).toBeNull();
		expect(resolve(settings, '', 'folder')).toBeNull();
		expect(() => assignFolder(settings, '', 'blue')).toThrow('non-root');
		expect(() => assignFolder(settings, 'A/B', 'missing')).toThrow(
			'does not exist',
		);
	});

	it('preserves IDs when names change and removes only references to a deleted color', () => {
		const settings = assignFolder(
			assignFolder(
				assignFolder(defaultSettings(), 'A', 'red'),
				'A/B',
				'blue',
			),
			'Other',
			'blue',
		);
		const renamed = putPaletteColor(settings, {
			id: 'blue',
			name: 'Ocean',
			seed: '#123456',
		});
		expect(renamed.assignments).toEqual(settings.assignments);
		expect(resolve(renamed, 'A/B/Note.md')?.color).toEqual({
			id: 'blue',
			name: 'Ocean',
			seed: '#123456',
		});
		const deleted = removePaletteColor(renamed, 'blue');
		expect(deleted.assignments).toEqual({ A: 'red' });
		expect(resolve(deleted, 'A/B/Note.md')?.color.id).toBe('red');
		expect(resolve(deleted, 'Other/Note.md')).toBeNull();
		expect(deleted.palette.some((color) => color.id === 'blue')).toBe(
			false,
		);
	});

	it('stores explicit folders only, even when many descendants are resolved', () => {
		const settings = assignFolder(defaultSettings(), 'A', 'red');
		for (let index = 0; index < 30; index++)
			resolve(settings, `A/Sub-${index}/Note.md`);
		expect(settings.assignments).toEqual({ A: 'red' });
	});

	it('treats prototype-named folders as ordinary own assignment keys', () => {
		const settings = assignFolder(defaultSettings(), '__proto__', 'red');
		expect(resolve(settings, '__proto__/Note.md')?.color.id).toBe('red');
		expect(Object.getPrototypeOf(settings.assignments)).toBe(
			Object.prototype,
		);
	});
});

describe('vault-relative paths', () => {
	it.each([
		['A\\Nested//./Note.md', 'A/Nested/Note.md'],
		['Árbol/日本語 / Space name.md', 'Árbol/日本語 / Space name.md'],
		[' A /e\u0301/', ' A /e\u0301'],
		['', ''],
		['/absolute', null],
		['C:\\absolute', null],
		['../outside', null],
		['A/../B', null],
		['A/\u0000B', null],
	])(
		'normalizes %j to %j without changing filename case or Unicode',
		(path, expected) => {
			expect(normalizeVaultPath(path)).toBe(expected);
		},
	);

	it('rewrites a nested renamed subtree while leaving its parent and prefix sibling intact', () => {
		let settings = defaultSettings();
		for (const path of [
			'A',
			'A/Nested',
			'A/Nested/Override',
			'A/Nested-other',
			'AB',
		])
			settings = assignFolder(settings, path, 'red');
		const moved = moveFolder(settings, 'A/Nested', 'A/Árbol with spaces');
		expect(moved.assignments).toEqual({
			A: 'red',
			'A/Árbol with spaces': 'red',
			'A/Árbol with spaces/Override': 'red',
			'A/Nested-other': 'red',
			AB: 'red',
		});
		expect(settings.assignments['A/Nested']).toBe('red');
	});

	it('lets unassigned moved items inherit their new branch and carries explicit nested overrides', () => {
		let settings = assignFolder(
			assignFolder(defaultSettings(), 'A', 'red'),
			'B',
			'blue',
		);
		expect(resolve(settings, 'A/Unassigned/Note.md')?.color.id).toBe('red');
		settings = moveFolder(settings, 'A/Unassigned', 'B/Unassigned');
		expect(resolve(settings, 'B/Unassigned/Note.md')?.color.id).toBe(
			'blue',
		);
		settings = assignFolder(settings, 'A/Assigned/Nested', 'purple');
		settings = moveFolder(settings, 'A/Assigned', 'B/Moved');
		expect(resolve(settings, 'B/Moved/Note.md')?.color.id).toBe('blue');
		expect(resolve(settings, 'B/Moved/Nested/Note.md')?.color.id).toBe(
			'purple',
		);
		expect(settings.assignments).toEqual({
			A: 'red',
			B: 'blue',
			'B/Moved/Nested': 'purple',
		});
	});

	it('removes only the deleted subtree and rejects assignment collisions without mutating input', () => {
		let settings = defaultSettings();
		for (const path of ['A', 'A/Sub', 'AB', 'B'])
			settings = assignFolder(settings, path, 'red');
		expect(deleteFolder(settings, 'A').assignments).toEqual({
			AB: 'red',
			B: 'red',
		});
		expect(() => moveFolder(settings, 'A', 'B')).toThrow('replace');
		expect(settings.assignments).toEqual({
			A: 'red',
			'A/Sub': 'red',
			AB: 'red',
			B: 'red',
		});
	});
});
