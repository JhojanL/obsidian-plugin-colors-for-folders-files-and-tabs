import type { Plugin } from 'obsidian';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { registerSettingsEvents } from '../../src/adapters/settings-events';
import { assignFolder } from '../../src/model/changes';
import { defaultSettings } from '../../src/model/settings';
import { SettingsStore } from '../../src/settings/store';
import { Notice, TFile, TFolder } from '../fixtures/obsidian';
import { MemorySettings } from '../fixtures/settings';

afterEach(() => {
	Notice.messages.length = 0;
});

/** Provide only public event registration to the plugin boundary; no note or filesystem API exists. */
function eventPlugin() {
	const listeners = new Map<string, (...args: unknown[]) => void>();
	const cleanups: (() => void)[] = [];
	const boundary = {
		app: {
			vault: {
				on: (name: string, callback: (...args: unknown[]) => void) => {
					listeners.set(name, callback);
					return () => {
						listeners.delete(name);
					};
				},
			},
		},
		registerEvent: (cleanup: () => void) => {
			cleanups.push(cleanup);
		},
	};
	return {
		// The fixture intentionally omits every unused host service.
		plugin: boundary as unknown as Plugin,
		emit: (name: string, ...args: unknown[]) => {
			listeners.get(name)?.(...args);
		},
		unload: () => {
			for (const cleanup of cleanups) cleanup();
		},
	};
}

describe('public vault metadata event tracking', () => {
	it('retains a failed folder-event edit, reports a real save retry, and persists it on recovery', async () => {
		const original = assignFolder(defaultSettings(), 'A', 'red');
		const storage = new MemorySettings(original);
		const store = new SettingsStore(storage);
		await store.reload();
		const host = eventPlugin();
		registerSettingsEvents(host.plugin, store);
		storage.saveData.mockRejectedValueOnce(new Error('Disk unavailable'));
		host.emit('rename', new TFolder('B'), 'A');
		await store.flush();
		expect(store.settings.assignments).toEqual({ B: 'red' });
		expect(storage.data).toBe(original);
		expect(store.hasUnsavedChanges).toBe(true);
		expect(Notice.messages).toHaveLength(1);
		expect(Notice.messages[0]).toContain('Disk unavailable');
		expect(Notice.messages[0]).toContain('Retry saving');
		await store.retrySave();
		const restarted = new SettingsStore(storage);
		await restarted.reload();
		expect(restarted.settings.assignments).toEqual({ B: 'red' });
		expect(store.hasUnsavedChanges).toBe(false);
	});
	it('reports reload cancellation without claiming the rejected folder-event edit is retained', async () => {
		const original = assignFolder(defaultSettings(), 'A', 'red');
		const storage = new MemorySettings(original);
		const store = new SettingsStore(storage);
		await store.reload();
		const host = eventPlugin();
		registerSettingsEvents(host.plugin, store);
		host.emit('rename', new TFolder('B'), 'A');
		await store.reload();
		expect(Notice.messages).toHaveLength(1);
		expect(Notice.messages[0]).toContain('retry the edit');
		expect(Notice.messages[0]).not.toContain('Retry saving');
		expect(store.settings.assignments).toEqual({ A: 'red' });
		expect(storage.data).toBe(original);
		expect(store.hasUnsavedChanges).toBe(false);
		expect(storage.saveData).not.toHaveBeenCalled();
	});
	it('rewrites folder and nested assignments on rename and removes only a deleted subtree', async () => {
		let settings = defaultSettings();
		for (const path of ['A', 'A/Nested', 'AB'])
			settings = assignFolder(settings, path, 'red');
		const storage = new MemorySettings(settings);
		const store = new SettingsStore(storage);
		await store.reload();
		const host = eventPlugin();
		registerSettingsEvents(host.plugin, store);
		host.emit('rename', new TFolder('B'), 'A');
		await store.flush();
		expect(store.settings.assignments).toEqual({
			B: 'red',
			'B/Nested': 'red',
			AB: 'red',
		});
		host.emit('delete', new TFolder('B'));
		await store.flush();
		expect(store.settings.assignments).toEqual({ AB: 'red' });
		expect(storage.saves).toHaveLength(2);
		expect(Notice.messages).toEqual([]);
	});

	it('invalidates file moves without rewriting assignments and unregisters both listeners', async () => {
		const storage = new MemorySettings(
			assignFolder(
				assignFolder(defaultSettings(), 'A', 'red'),
				'B',
				'blue',
			),
		);
		const store = new SettingsStore(storage);
		await store.reload();
		const listener = vi.fn();
		store.subscribe(listener);
		const host = eventPlugin();
		registerSettingsEvents(host.plugin, store);
		expect(
			store.resolve({ path: 'A/Note.md', kind: 'file' })?.color.id,
		).toBe('red');
		host.emit('rename', new TFile('B/Note.md'), 'A/Note.md');
		expect(
			store.resolve({ path: 'B/Note.md', kind: 'file' })?.color.id,
		).toBe('blue');
		host.emit('delete', new TFile('B/Note.md'));
		expect(listener).toHaveBeenCalledTimes(2);
		expect(storage.saveData).not.toHaveBeenCalled();
		host.unload();
		host.emit('rename', new TFolder('C'), 'A');
		host.emit('delete', new TFolder('B'));
		expect(listener).toHaveBeenCalledTimes(2);
	});

	it('leaves read-only data untouched when folders change', async () => {
		const future = { schemaVersion: 5, untouched: true };
		const storage = new MemorySettings(future);
		const store = new SettingsStore(storage);
		await store.reload();
		const host = eventPlugin();
		registerSettingsEvents(host.plugin, store);
		host.emit('rename', new TFolder('B'), 'A');
		host.emit('delete', new TFolder('B'));
		await store.flush();
		expect(storage.saveData).not.toHaveBeenCalled();
		expect(storage.data).toBe(future);
	});
});
