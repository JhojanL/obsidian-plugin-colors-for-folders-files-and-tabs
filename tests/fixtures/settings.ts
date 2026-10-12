import { vi } from 'vitest';
import type { ColorSettings } from '../../src/model/types';
import type { SettingsStorage } from '../../src/settings/store';

/** Metadata-only in-memory data.json boundary; it provides no vault read/write methods. */
export class MemorySettings implements SettingsStorage {
	readonly saves: ColorSettings[] = [];

	/** data is the stored settings payload, including deliberately corrupt or unsupported fixtures. */
	constructor(public data: unknown = null) {}

	loadData = vi.fn(async (): Promise<unknown> => this.data);
	saveData = vi.fn(async (settings: ColorSettings): Promise<void> => {
		this.saves.push(settings);
		this.data = settings;
	});
}

/** Create a manually completed promise for deterministic storage concurrency tests. */
export function deferred<T>() {
	let resolve!: (value: T | PromiseLike<T>) => void;
	const promise = new Promise<T>((complete) => {
		resolve = complete;
	});
	return { promise, resolve };
}
