import { describe, expect, it } from 'vitest';
import { defaultSettings, readSettings } from '../../src/model/settings';

const valid = {
	schemaVersion: 1,
	palette: [{ id: 'custom-1', name: ' My color ', seed: '#Ab12Cd' }],
	assignments: { 'Árbol\\Folder name//': 'custom-1' },
};

describe('settings validation and migration', () => {
	it('provides fresh unassigned defaults and stable named theme entries', () => {
		const first = readSettings(null);
		expect(first.status).toBe('empty');
		expect(first.writable).toBe(true);
		expect(first.settings.assignments).toEqual({});
		expect(first.settings.palette.map((color) => color.id)).toEqual([
			'red',
			'orange',
			'yellow',
			'green',
			'cyan',
			'blue',
			'purple',
			'pink',
		]);
		expect(defaultSettings()).toEqual(first.settings);
		expect(defaultSettings().palette).not.toBe(first.settings.palette);
	});

	it('canonicalizes valid data without mutating it or changing palette IDs or path case', () => {
		const result = readSettings(valid);
		expect(result.status).toBe('valid');
		expect(result.settings.palette).toEqual([
			{ id: 'custom-1', name: 'My color', seed: '#ab12cd' },
		]);
		expect(result.settings.assignments).toEqual({
			'Árbol/Folder name': 'custom-1',
		});
		expect(valid.palette[0]?.seed).toBe('#Ab12Cd');
		expect(Object.isFrozen(result.settings.assignments)).toBe(true);
		expect(Object.isFrozen(result.settings.palette[0])).toBe(true);
	});

	it.each([undefined, 0])(
		'validates legacy schema %j before adding version 1',
		(schemaVersion) => {
			const result = readSettings({ ...valid, schemaVersion });
			expect(result.status).toBe('migrated');
			expect(result.settings).toEqual(readSettings(valid).settings);
			expect(result.writable).toBe(true);
		},
	);

	it.each([
		['non-record', []],
		['missing fields', {}],
		['unknown field', { ...valid, extra: 'preserve me' }],
		['bad version', { ...valid, schemaVersion: '1' }],
		[
			'bad legacy payload',
			{ ...valid, schemaVersion: 0, palette: 'invalid' },
		],
		[
			'unknown token',
			{
				...valid,
				palette: [
					{
						id: 'custom-1',
						name: 'Color',
						seed: '--background-primary',
					},
				],
			},
		],
		[
			'alpha hex',
			{
				...valid,
				palette: [{ id: 'custom-1', name: 'Color', seed: '#12345678' }],
			},
		],
		[
			'short hex',
			{
				...valid,
				palette: [{ id: 'custom-1', name: 'Color', seed: '#abc' }],
			},
		],
		[
			'CSS expression',
			{
				...valid,
				palette: [
					{
						id: 'custom-1',
						name: 'Color',
						seed: 'url(https://invalid.example)',
					},
				],
			},
		],
		[
			'empty name',
			{
				...valid,
				palette: [{ id: 'custom-1', name: ' ', seed: '#123456' }],
			},
		],
		[
			'duplicate IDs',
			{ ...valid, palette: [...valid.palette, ...valid.palette] },
		],
		['missing color', { ...valid, assignments: { A: 'missing' } }],
		['root assignment', { ...valid, assignments: { '': 'custom-1' } }],
		['absolute path', { ...valid, assignments: { '/A': 'custom-1' } }],
		['path traversal', { ...valid, assignments: { 'A/../B': 'custom-1' } }],
		[
			'normalization collision',
			{ ...valid, assignments: { A: 'custom-1', 'A/': 'custom-1' } },
		],
	])('keeps %s data read-only with neutral defaults', (_label, data) => {
		const result = readSettings(data);
		expect(result.status).toBe('invalid');
		expect(result.writable).toBe(false);
		expect(result.settings.assignments).toEqual({});
	});

	it('recognizes future schemas before interpreting their payload and prohibits writes', () => {
		const future = {
			schemaVersion: 2,
			someFutureData: { untouched: true },
		};
		expect(readSettings(future)).toEqual({
			status: 'future',
			writable: false,
			settings: defaultSettings(),
		});
		expect(future.someFutureData.untouched).toBe(true);
	});
});
