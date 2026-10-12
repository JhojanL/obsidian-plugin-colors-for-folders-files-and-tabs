import { describe, expect, it, vi } from 'vitest';
import type { PluginManifest, Stat } from 'obsidian';
import { assignFolder } from '../../src/model/changes';
import { defaultSettings } from '../../src/model/settings';
import type { ColorSettings } from '../../src/model/types';
import { createSettingsStorage } from '../../src/settings/storage';
import { SettingsStore } from '../../src/settings/store';
import { MemorySettings, deferred } from '../fixtures/settings';

/** bytes holds exact data.json text; null represents a missing file, matching the host's swallowed read failures. */
function nativeSettings(bytes: string | null = null) {
	const file = { bytes };
	const manifest: Pick<PluginManifest, 'dir'> = {
		dir: '.test-config/plugins/colors-for-folders-files-and-tabs',
	};
	const loadData = vi.fn(async (): Promise<unknown> => {
		try {
			return file.bytes === null
				? null
				: (JSON.parse(file.bytes) as unknown);
		} catch {
			return null;
		}
	});
	const saveData = vi.fn(async (settings: ColorSettings): Promise<void> => {
		file.bytes = JSON.stringify(settings);
	});
	const stat = vi.fn(async (path: string): Promise<Stat | null> => {
		if (
			path !==
			'.test-config/plugins/colors-for-folders-files-and-tabs/data.json'
		)
			throw new Error('Only this plugin settings file may be inspected.');
		return file.bytes === null
			? null
			: { type: 'file', ctime: 0, mtime: 0, size: file.bytes.length };
	});
	const plugin = {
		manifest,
		loadData,
		saveData,
		app: { vault: { adapter: { stat } } },
	};
	return {
		file,
		plugin,
		stat,
		store: new SettingsStore(createSettingsStorage(plugin)),
	};
}

describe('native settings protection', () => {
	it('allows first-install edits and restores them after reload without touching unrelated paths', async () => {
		const { file, store, plugin } = nativeSettings();
		await store.reload();
		expect(store.status).toBe('empty');
		expect(store.writable).toBe(true);
		expect(file.bytes).toBeNull();
		expect(plugin.saveData).not.toHaveBeenCalled();
		await store.setAssignment('A', 'red');
		await store.setColoring('text', true);
		const restarted = new SettingsStore(createSettingsStorage(plugin));
		await restarted.reload();
		expect(restarted.status).toBe('valid');
		expect(restarted.settings.assignments).toEqual({ A: 'red' });
		expect(restarted.settings.coloring.text).toBe(true);
	});

	it('keeps malformed bytes intact when Obsidian returns null and an edit is attempted', async () => {
		const { file, plugin, store } = nativeSettings('{broken');
		await expect(plugin.loadData()).resolves.toBeNull();
		await store.reload();
		expect(store.status).toBe('load-error');
		expect(store.writable).toBe(false);
		await expect(store.setColoring('text', true)).rejects.toThrow(
			'recovered',
		);
		expect(file.bytes).toBe('{broken');
		expect(plugin.saveData).not.toHaveBeenCalled();
	});

	it.each(['', 'null', ' \nnull\n '])(
		'protects an existing empty or null JSON file (%j)',
		async (bytes) => {
			const { file, plugin, store } = nativeSettings(bytes);
			await store.reload();
			expect(store.writable).toBe(false);
			await expect(store.setAssignment('A', 'red')).rejects.toThrow(
				'recovered',
			);
			expect(file.bytes).toBe(bytes);
			expect(plugin.saveData).not.toHaveBeenCalled();
		},
	);

	it('blocks a swallowed host read failure without overwriting valid saved bytes', async () => {
		const bytes = JSON.stringify(
			assignFolder(defaultSettings(), 'A', 'blue'),
			null,
			2,
		);
		const { file, plugin, store } = nativeSettings(bytes);
		plugin.loadData.mockResolvedValue(null);
		await store.reload();
		expect(store.status).toBe('load-error');
		await expect(store.setAssignment('A', 'red')).rejects.toThrow(
			'recovered',
		);
		expect(file.bytes).toBe(bytes);
		expect(plugin.saveData).not.toHaveBeenCalled();
	});

	it('fails read-only when missing-file metadata cannot be checked', async () => {
		const { file, plugin, stat, store } = nativeSettings();
		stat.mockRejectedValue(new Error('Access denied'));
		await store.reload();
		expect(store.status).toBe('load-error');
		await expect(store.setColoring('icons', false)).rejects.toThrow(
			'recovered',
		);
		expect(file.bytes).toBeNull();
		expect(plugin.saveData).not.toHaveBeenCalled();
	});

	it('fails read-only when the host omits the plugin directory', async () => {
		const { plugin, store, stat } = nativeSettings();
		plugin.manifest.dir = undefined;
		await store.reload();
		expect(store.status).toBe('load-error');
		await expect(store.setAssignment('A', 'red')).rejects.toThrow(
			'recovered',
		);
		expect(stat).not.toHaveBeenCalled();
		expect(plugin.saveData).not.toHaveBeenCalled();
	});

	it.each([
		['future', '{"schemaVersion":7,"untouched":"keep this"}'],
		[
			'invalid',
			'{"schemaVersion":1,"palette":[],"assignments":{"A":"missing"}}',
		],
	])(
		'preserves exact %s data at the native boundary',
		async (status, bytes) => {
			const { file, store, plugin } = nativeSettings(bytes);
			await store.reload();
			expect(store.status).toBe(status);
			await expect(store.setAssignment('A', 'red')).rejects.toThrow(
				'recovered',
			);
			expect(file.bytes).toBe(bytes);
			expect(plugin.saveData).not.toHaveBeenCalled();
		},
	);

	it('revalidates malformed bytes before an edit even without an external reload notification', async () => {
		const { file, store, plugin } = nativeSettings(
			JSON.stringify(defaultSettings()),
		);
		await store.reload();
		expect(store.writable).toBe(true);
		file.bytes = '{broken';
		await expect(store.setColoring('text', true)).rejects.toThrow(
			'recovered',
		);
		expect(store.status).toBe('load-error');
		expect(store.writable).toBe(false);
		expect(file.bytes).toBe('{broken');
		expect(plugin.saveData).not.toHaveBeenCalled();
	});

	it('recovers after repaired data is reloaded and preserves recovered assignments during the next edit', async () => {
		const { file, store, plugin } = nativeSettings('{broken');
		await store.reload();
		expect(store.writable).toBe(false);
		file.bytes = JSON.stringify(
			assignFolder(defaultSettings(), 'Recovered', 'blue'),
		);
		await store.reload();
		expect(store.status).toBe('valid');
		expect(plugin.saveData).not.toHaveBeenCalled();
		await store.setAssignment('Local', 'red');
		await store.reload();
		expect(store.settings.assignments).toEqual({
			Recovered: 'blue',
			Local: 'red',
		});
	});

	it('retains a failed native save for retry and restores the successfully retried data', async () => {
		const { file, store, plugin } = nativeSettings();
		await store.reload();
		plugin.saveData.mockRejectedValueOnce(new Error('Disk unavailable'));
		await expect(store.setAssignment('A', 'red')).rejects.toThrow(
			'Disk unavailable',
		);
		expect(file.bytes).toBeNull();
		expect(store.settings.assignments).toEqual({ A: 'red' });
		expect(store.hasUnsavedChanges).toBe(true);
		expect(store.saveError).toBe('Disk unavailable');
		await store.retrySave();
		expect(store.hasUnsavedChanges).toBe(false);
		expect(store.saveError).toBeNull();
		await store.reload();
		expect(store.settings.assignments).toEqual({ A: 'red' });
	});
});

describe('settings persistence', () => {
	it('serializes successive saves into immutable snapshots and restores them in a new store', async () => {
		const storage = new MemorySettings();
		const store = new SettingsStore(storage);
		await store.reload();
		const started = deferred<void>();
		const finish = deferred<void>();
		storage.saveData.mockImplementationOnce(async (settings) => {
			storage.saves.push(settings);
			started.resolve();
			await finish.promise;
			storage.data = settings;
		});
		const first = store.setAssignment('A', 'red');
		const second = store.setAssignment('A/B', 'blue');
		await started.promise;
		expect(storage.saveData).toHaveBeenCalledTimes(1);
		expect(storage.saves[0]?.assignments).toEqual({ A: 'red' });
		finish.resolve();
		await Promise.all([first, second]);
		expect(storage.saves.map((settings) => settings.assignments)).toEqual([
			{ A: 'red' },
			{ A: 'red', 'A/B': 'blue' },
		]);
		const restarted = new SettingsStore(storage);
		await restarted.reload();
		expect(
			restarted.resolve({ path: 'A/B/Note.md', kind: 'file' })?.color.id,
		).toBe('blue');
	});

	it('retains unsaved edits after a failed write and permits retrying the same assignment', async () => {
		const storage = new MemorySettings();
		const store = new SettingsStore(storage);
		await store.reload();
		storage.saveData.mockRejectedValueOnce(new Error('Disk unavailable'));
		await expect(store.setAssignment('A', 'red')).rejects.toThrow(
			'Disk unavailable',
		);
		expect(storage.data).toBeNull();
		await store.setAssignment('A', 'red');
		expect(storage.saves[0]?.assignments).toEqual({ A: 'red' });
		await store.setAssignment('B', 'blue');
		expect(storage.saves[1]?.assignments).toEqual({ A: 'red', B: 'blue' });
	});

	it('can revert a failed edit without leaving its unsaved identity cached', async () => {
		const storage = new MemorySettings();
		const store = new SettingsStore(storage);
		await store.reload();
		storage.saveData.mockRejectedValueOnce(new Error('Disk unavailable'));
		await expect(store.setAssignment('A', 'red')).rejects.toThrow(
			'Disk unavailable',
		);
		expect(
			store.resolve({ path: 'A/Note.md', kind: 'file' })?.color.id,
		).toBe('red');
		await store.setAssignment('A', null);
		expect(store.settings.assignments).toEqual({});
		expect(store.resolve({ path: 'A/Note.md', kind: 'file' })).toBeNull();
		expect(storage.saveData).toHaveBeenCalledTimes(1);
	});

	it('loads migrations without writing and saves version 1 only on a valid edit', async () => {
		const { schemaVersion: omitted, ...legacy } = assignFolder(
			defaultSettings(),
			'A',
			'red',
		);
		expect(omitted).toBe(1);
		const storage = new MemorySettings(legacy);
		const store = new SettingsStore(storage);
		await store.reload();
		expect(store.status).toBe('migrated');
		expect(storage.saveData).not.toHaveBeenCalled();
		await store.setAssignment('B', 'blue');
		expect(storage.saves[0]?.schemaVersion).toBe(1);
		expect(storage.saves[0]?.assignments).toEqual({ A: 'red', B: 'blue' });
	});

	it.each([
		[
			'invalid',
			{ schemaVersion: 1, palette: [], assignments: { A: 'missing' } },
		],
		['future', { schemaVersion: 7, untouched: 'keep this' }],
	])(
		'never overwrites %s data during reload or an attempted edit',
		async (status, data) => {
			const storage = new MemorySettings(data);
			const store = new SettingsStore(storage);
			await store.reload();
			expect(store.status).toBe(status);
			await expect(store.setAssignment('A', 'red')).rejects.toThrow(
				'recovered',
			);
			expect(storage.data).toBe(data);
			expect(storage.saveData).not.toHaveBeenCalled();
		},
	);

	it('blocks writes when corrupt or future data appears before the external callback arrives', async () => {
		const storage = new MemorySettings(
			assignFolder(defaultSettings(), 'A', 'red'),
		);
		const store = new SettingsStore(storage);
		await store.reload();
		expect(
			store.resolve({ path: 'A/Note.md', kind: 'file' })?.color.id,
		).toBe('red');
		storage.data = { schemaVersion: 3, untouched: true };
		await expect(store.setAssignment('A', 'red')).rejects.toThrow(
			'recovered',
		);
		expect(store.status).toBe('future');
		expect(store.resolve({ path: 'A/Note.md', kind: 'file' })).toBeNull();
		expect(storage.saveData).not.toHaveBeenCalled();
	});

	it('fails read-only on unreadable JSON and allows recovery through an external reload', async () => {
		const storage = new MemorySettings();
		storage.loadData.mockRejectedValueOnce(new SyntaxError('Invalid JSON'));
		const store = new SettingsStore(storage);
		await store.reload();
		expect(store.status).toBe('load-error');
		await expect(store.setAssignment('A', 'red')).rejects.toThrow(
			'recovered',
		);
		await store.reload();
		await store.setAssignment('A', 'red');
		expect(storage.saves[0]?.assignments).toEqual({ A: 'red' });
	});

	it('rejects invalid local updates before saving or changing a cached identity', async () => {
		const storage = new MemorySettings(
			assignFolder(defaultSettings(), 'A', 'red'),
		);
		const store = new SettingsStore(storage);
		await store.reload();
		const target = { path: 'A/Note.md', kind: 'file' } as const;
		const before = store.resolve(target);
		await expect(
			store.update((settings) => ({
				...settings,
				assignments: { A: 'missing' },
			})),
		).rejects.toThrow('invalid');
		expect(store.resolve(target)).toBe(before);
		expect(storage.saveData).not.toHaveBeenCalled();
	});
});

describe('external settings and cache invalidation', () => {
	it('invalidates neutral and colored results after assignments, palette edits, and deletion', async () => {
		const store = new SettingsStore(new MemorySettings());
		await store.reload();
		const target = { path: 'A/B/Note.md', kind: 'file' } as const;
		expect(store.resolve(target)).toBeNull();
		await store.setAssignment('A', 'red');
		const red = store.resolve(target);
		expect(store.resolve(target)).toBe(red);
		await store.putColor({
			id: 'red',
			name: 'Renamed red',
			seed: '#123456',
		});
		expect(store.resolve(target)?.color).toEqual({
			id: 'red',
			name: 'Renamed red',
			seed: '#123456',
		});
		await store.setAssignment('A/B', 'blue');
		await store.removeColor('blue');
		expect(store.resolve(target)?.color.id).toBe('red');
		await store.setAssignment('A', null);
		expect(store.resolve(target)).toBeNull();
	});

	it('refreshes listeners on path changes and external reloads, then releases subscriptions', async () => {
		const storage = new MemorySettings(
			assignFolder(defaultSettings(), 'A', 'red'),
		);
		const store = new SettingsStore(storage);
		await store.reload();
		const listener = vi.fn();
		const release = store.subscribe(listener);
		expect(store.resolve({ path: 'B/Note.md', kind: 'file' })).toBeNull();
		await store.moveFolder('A', 'B');
		expect(
			store.resolve({ path: 'B/Note.md', kind: 'file' })?.color.id,
		).toBe('red');
		expect(store.resolve({ path: 'A/Note.md', kind: 'file' })).toBeNull();
		expect(listener).toHaveBeenCalled();
		listener.mockClear();
		storage.data = assignFolder(defaultSettings(), 'B', 'blue');
		await store.reload();
		expect(
			store.resolve({ path: 'B/Note.md', kind: 'file' })?.color.id,
		).toBe('blue');
		expect(listener).toHaveBeenCalled();
		const delivered = listener.mock.calls.length;
		release();
		await store.deleteFolder('B');
		expect(listener).toHaveBeenCalledTimes(delivered);
		expect(store.resolve({ path: 'B/Note.md', kind: 'file' })).toBeNull();
	});

	it('applies an edit to newer supported data found by the pre-save read', async () => {
		const storage = new MemorySettings();
		const store = new SettingsStore(storage);
		await store.reload();
		storage.data = assignFolder(defaultSettings(), 'External', 'blue');
		await store.setAssignment('Local', 'red');
		expect(storage.saves[0]?.assignments).toEqual({
			External: 'blue',
			Local: 'red',
		});
	});

	it('rejects queued stale edits when external reload follows an active save', async () => {
		const storage = new MemorySettings();
		const store = new SettingsStore(storage);
		await store.reload();
		const started = deferred<void>();
		const finish = deferred<void>();
		const external = assignFolder(defaultSettings(), 'External', 'blue');
		storage.saveData.mockImplementationOnce(async (settings) => {
			storage.saves.push(settings);
			started.resolve();
			await finish.promise;
			// The external service delivers its newer payload after the active host write.
			storage.data = external;
		});
		const first = store.setAssignment('A', 'red');
		const second = store.setAssignment('B', 'blue');
		const rejection = expect(second).rejects.toThrow('externally');
		await started.promise;
		const reload = store.reload();
		finish.resolve();
		await Promise.all([first, rejection, reload]);
		expect(storage.saveData).toHaveBeenCalledTimes(1);
		expect(store.settings.assignments).toEqual({ External: 'blue' });
		expect(store.resolve({ path: 'A/Note.md', kind: 'file' })).toBeNull();
	});

	it('cancels an edit whose pre-save read finishes after an external reload request', async () => {
		const storage = new MemorySettings();
		const store = new SettingsStore(storage);
		await store.reload();
		const started = deferred<void>();
		const finish = deferred<unknown>();
		storage.loadData.mockImplementationOnce(() => {
			started.resolve();
			return finish.promise;
		});
		const edit = store.setAssignment('A', 'red');
		const rejection = expect(edit).rejects.toThrow('externally');
		await started.promise;
		storage.data = { schemaVersion: 9, untouched: true };
		const reload = store.reload();
		finish.resolve(null);
		await Promise.all([rejection, reload]);
		expect(store.status).toBe('future');
		expect(storage.saveData).not.toHaveBeenCalled();
	});

	it('cancels queued operations and listeners when the plugin unloads', async () => {
		const storage = new MemorySettings();
		const store = new SettingsStore(storage);
		await store.reload();
		const listener = vi.fn();
		store.subscribe(listener);
		const pending = store.setAssignment('A', 'red');
		const rejection = expect(pending).rejects.toThrow('unloaded');
		store.dispose();
		await rejection;
		await store.reload();
		store.invalidate();
		expect(listener).not.toHaveBeenCalled();
		expect(storage.saveData).not.toHaveBeenCalled();
	});
});
