import { describe, expect, it } from 'vitest';
import { defaultSettings } from '../../src/model/settings';
import type { PaletteColor } from '../../src/model/types';
import { SettingsStore } from '../../src/settings/store';
import { readColorDraft } from '../../src/ui/color-draft';
import { MemorySettings } from '../fixtures/settings';

const palette: readonly PaletteColor[] = [
	...defaultSettings().palette,
	{ id: 'sky', name: 'Sky Blue', seed: '#aabbcc' },
	{ id: 'gray', name: 'gris', seed: '#777777' },
	{ id: 'cafe', name: 'Café', seed: '#123456' },
];

describe('palette-wide draft validation', () => {
	it.each(['gris', 'Azul marino', '  AzuL  marino  ', 'Cafe\u0301'])(
		'preserves trimmed display text %j without normalizing its spelling',
		(name) => {
			expect(readColorDraft('custom-1', name, ' #ABCDEF ')).toEqual({
				color: { id: 'custom-1', name: name.trim(), seed: '#abcdef' },
				nameError: '',
				hexError: '',
			});
		},
	);
	it.each([
		{ hex: '#aabbcc', existing: 'Sky Blue' },
		{ hex: ' #AABBCC ', existing: 'Sky Blue' },
		{ hex: '#00C4C4', existing: 'Cyan' },
	])(
		'rejects custom/theme hex duplicate $hex as $existing',
		({ hex, existing }) => {
			expect(
				readColorDraft('new', 'Different name', hex, {
					palette,
					resolveSeedHex: (seed) =>
						seed === '--color-cyan' ? '#00c4c4' : seed,
				}),
			).toEqual({
				color: null,
				nameError: '',
				hexError: `This color already exists as "${existing}".`,
			});
		},
	);
	it.each([
		['sky blue', 'Sky Blue'],
		['  Sky\t \nBLUE  ', 'Sky Blue'],
		['Sky\u00a0\u00a0Blue', 'Sky Blue'],
		['Ｓｋｙ Ｂｌｕｅ', 'Sky Blue'],
		['Gris', 'gris'],
		['CAFE\u0301', 'Café'],
	])(
		'rejects equivalent name %j without changing the conflict display name',
		(name, existing) => {
			expect(readColorDraft('new', name, '#2468ac', { palette })).toEqual(
				{
					color: null,
					nameError: `A color named "${existing}" already exists.`,
					hexError: '',
				},
			);
		},
	);
	it.each(defaultSettings().palette.map((color) => color.name))(
		'includes built-in %s in duplicate name validation',
		(name) => {
			expect(
				readColorDraft('new', ` ${name.toUpperCase()} `, '#2468ac', {
					palette,
				}).nameError,
			).toBe(`A color named "${name}" already exists.`);
		},
	);
	it('reports both name and hex conflicts independently', () => {
		expect(
			readColorDraft('new', 'sky blue', ' #777777 ', { palette }),
		).toEqual({
			color: null,
			nameError: 'A color named "Sky Blue" already exists.',
			hexError: 'This color already exists as "gris".',
		});
		expect(readColorDraft('new', 'sky blue', '#oops', { palette })).toEqual(
			{
				color: null,
				nameError: 'A color named "Sky Blue" already exists.',
				hexError: 'Enter six hex digits, such as #8b6cef.',
			},
		);
	});
	it('excludes only the edited ID while continuing to reject other colors', () => {
		expect(
			readColorDraft('sky', ' SKY blue ', ' #AABBCC ', { palette }),
		).toEqual({
			color: { id: 'sky', name: 'SKY blue', seed: '#aabbcc' },
			nameError: '',
			hexError: '',
		});
		expect(
			readColorDraft('sky', 'Gris', '#aabbcc', { palette }).nameError,
		).toBe('A color named "gris" already exists.');
		expect(
			readColorDraft('sky', 'Sky Blue', '#123456', { palette }).hexError,
		).toBe('This color already exists as "Café".');
	});
	it('keeps an unresolved original theme seed instead of treating the editor fallback as its value', () => {
		expect(
			readColorDraft('red', 'Red renamed', '#808080', {
				palette: [
					...palette,
					{ id: 'neutral', name: 'Neutral', seed: '#808080' },
				],
				retainedSeed: '--color-red',
			}).color,
		).toEqual({ id: 'red', name: 'Red renamed', seed: '--color-red' });
	});
});

describe('palette save validation', () => {
	it.each([
		[
			{ id: 'new', name: '  SKY\tblue ', seed: '#2468ac' },
			'A color named "Sky Blue" already exists.',
		],
		[
			{ id: 'sky', name: 'Gris', seed: '#aabbcc' },
			'A color named "gris" already exists.',
		],
		[
			{ id: 'new', name: 'Different name', seed: '#AABBCC' },
			'This color already exists as "Sky Blue".',
		],
		[
			{ id: 'sky', name: 'Sky Blue', seed: '#123456' },
			'This color already exists as "Café".',
		],
	] as const)(
		'rejects conflicting save %j before mutation or disk writes',
		async (color, error) => {
			const storage = new MemorySettings({
				...defaultSettings(),
				palette,
			});
			const store = new SettingsStore(storage);
			await store.reload();
			const before = store.settings;
			await expect(store.putColor(color)).rejects.toThrow(error);
			expect(store.settings).toBe(before);
			expect(storage.saveData).not.toHaveBeenCalled();
		},
	);
	it('rechecks built-in hex values at the save boundary', async () => {
		const storage = new MemorySettings();
		const store = new SettingsStore(storage);
		await store.reload();
		await expect(
			store.putColor(
				{ id: 'new', name: 'Different name', seed: '#00C4C4' },
				(seed) => (seed === '--color-cyan' ? '#00c4c4' : seed),
			),
		).rejects.toThrow('This color already exists as "Cyan".');
		expect(storage.saveData).not.toHaveBeenCalled();
	});
	it('rechecks queued additions against the palette saved by the previous action', async () => {
		const storage = new MemorySettings();
		const store = new SettingsStore(storage);
		await store.reload();
		const results = await Promise.allSettled([
			store.putColor({
				id: 'first',
				name: 'Azul marino',
				seed: '#2468ac',
			}),
			store.putColor({
				id: 'second',
				name: '  AZUL\tMARINO ',
				seed: '#123456',
			}),
		]);
		expect(results).toEqual([
			{ status: 'fulfilled', value: undefined },
			{
				status: 'rejected',
				reason: new Error(
					'A color named "Azul marino" already exists.',
				),
			},
		]);
		expect(storage.saves).toHaveLength(1);
		expect(
			store.settings.palette.find((color) => color.id === 'first'),
		).toEqual({
			id: 'first',
			name: 'Azul marino',
			seed: '#2468ac',
		});
	});
});
