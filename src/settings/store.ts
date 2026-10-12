import {
	assignFolder,
	deleteFolder,
	moveFolder,
	putPaletteColor,
	removePaletteColor,
} from '../model/changes';
import type { SeedHexResolver } from '../model/palette-validation';
import { normalizeVaultPath } from '../model/paths';
import { resolveColorIdentity } from '../model/resolve';
import {
	defaultSettings,
	readSettings,
	type SettingsRead,
	type SettingsStatus,
} from '../model/settings';
import type {
	ColorIdentity,
	ColorSettings,
	ColorTarget,
	PaletteColor,
	ColoringOptions,
} from '../model/types';

/** Settings I/O boundary; host adapters must distinguish absent files from failed reads. */
export interface SettingsStorage {
	/** Read an untrusted payload; null/undefined means absent data.json, while unreadable existing data must reject. */
	loadData(): Promise<unknown>;
	/** Persist settings as an immutable snapshot through Obsidian's plugin settings API. */
	saveData(settings: ColorSettings): Promise<void>;
}

/** Serialize local edits and reloads; external services can still race an in-flight host write. */
export class SettingsStore {
	private current: SettingsRead = {
		settings: defaultSettings(),
		status: 'load-error',
		writable: false,
	};
	private diskFingerprint: string | null = null;
	private queue: Promise<void> = Promise.resolve();
	private generation = 0;
	private disposed = false;
	private writeError: string | null = null;
	private readonly listeners = new Set<() => void>();
	private readonly cache = new Map<string, ColorIdentity | null>();

	/** storage reads and writes only this plugin's data.json; no vault content is accessed. */
	constructor(private readonly storage: SettingsStorage) {}

	get settings(): ColorSettings {
		return this.current.settings;
	}
	get status(): SettingsStatus {
		return this.current.status;
	}
	get writable(): boolean {
		return this.current.writable;
	}
	get isDisposed(): boolean {
		return this.disposed;
	}
	get hasUnsavedChanges(): boolean {
		return (
			this.writable &&
			this.diskFingerprint !== null &&
			JSON.stringify(this.settings) !== this.diskFingerprint
		);
	}
	get saveError(): string | null {
		return this.writeError;
	}

	/** Subscribe listener to model and persistence changes; the returned callback releases the subscription. */
	subscribe(listener: () => void): () => void {
		this.listeners.add(listener);
		return () => {
			this.listeners.delete(listener);
		};
	}

	/** Clear cached colored and neutral identities, then refresh subscribed visible adapters. */
	invalidate(): void {
		this.cache.clear();
		this.notify();
	}

	/** Resolve target's metadata, caching only requested paths until the next model or path change. */
	readonly resolve = (target: ColorTarget): ColorIdentity | null => {
		const path = normalizeVaultPath(target.path);
		if (!path) return null;
		const key = `${target.kind}:${path}`;
		if (!this.cache.has(key)) {
			// Bound retained visible/recent identities without scanning or storing descendants.
			if (this.cache.size >= 1024) this.cache.clear();
			this.cache.set(
				key,
				resolveColorIdentity(this.settings, { ...target, path }),
			);
		}
		return this.cache.get(key) ?? null;
	};

	/** Reload external data after active I/O; queued edits from before this request are rejected. */
	reload(): Promise<void> {
		const generation = ++this.generation;
		return this.enqueue(async () => {
			if (this.disposed) return;
			const loaded = await this.read();
			if (!this.disposed && generation === this.generation)
				this.install(loaded);
		});
	}

	/** Queue change against the latest settings, validating and snapshotting before any host write. */
	update(change: (settings: ColorSettings) => ColorSettings): Promise<void> {
		const generation = this.generation;
		return this.enqueue(async () => {
			this.requireCurrent(generation);
			if (!this.writable)
				throw new Error(
					'Saved color settings must be recovered before editing.',
				);
			const loaded = await this.read();
			this.requireCurrent(generation);
			if (
				!loaded.writable ||
				JSON.stringify(loaded.settings) !== this.diskFingerprint
			)
				this.install(loaded);
			this.requireCurrent(generation);
			if (!this.writable)
				throw new Error(
					'Saved color settings must be recovered before editing.',
				);
			const candidate = readSettings(change(this.settings));
			if (candidate.status !== 'valid')
				throw new Error('The color settings change is invalid.');
			const fingerprint = JSON.stringify(candidate.settings);
			if (fingerprint !== JSON.stringify(this.settings)) {
				this.current = candidate;
				this.invalidate();
			}
			if (fingerprint === this.diskFingerprint) {
				this.writeError = null;
				this.notify();
				return;
			}
			this.requireCurrent(generation);
			try {
				await this.storage.saveData(candidate.settings);
				this.diskFingerprint = fingerprint;
				this.writeError = null;
			} catch (error) {
				this.writeError =
					error instanceof Error
						? error.message
						: 'Storage unavailable.';
				throw error;
			} finally {
				this.notify();
			}
		});
	}

	/** Retry the retained snapshot; a changed external payload still wins the pre-save conflict check. */
	retrySave(): Promise<void> {
		return this.update((settings) => settings);
	}

	/** Set paletteId on folderPath; null clears the assignment and restores inheritance. */
	setAssignment(folderPath: string, paletteId: string | null): Promise<void> {
		return this.update((settings) =>
			assignFolder(settings, folderPath, paletteId),
		);
	}

	/** Save color by stable ID, rechecking the latest palette; resolveSeedHex optionally resolves theme values in the editor's document. */
	putColor(
		color: PaletteColor,
		resolveSeedHex?: SeedHexResolver,
	): Promise<void> {
		const snapshot = { ...color };
		return this.update((settings) =>
			putPaletteColor(settings, snapshot, resolveSeedHex),
		);
	}

	/** Delete paletteId and its explicit references; the workflow confirms referenced deletions first. */
	removeColor(paletteId: string): Promise<void> {
		return this.update((settings) =>
			removePaletteColor(settings, paletteId),
		);
	}

	/** Enable or disable channel independently without altering folder assignments. */
	setColoring(
		channel: keyof ColoringOptions,
		enabled: boolean,
	): Promise<void> {
		return this.update((settings) => ({
			...settings,
			coloring: { ...settings.coloring, [channel]: enabled },
		}));
	}

	/** Follow a folder rename/move from oldPath to newPath without touching the folder itself. */
	moveFolder(oldPath: string, newPath: string): Promise<void> {
		return this.update((settings) =>
			moveFolder(settings, oldPath, newPath),
		);
	}

	/** Forget assignments only below deleted folderPath, without issuing a vault delete. */
	deleteFolder(folderPath: string): Promise<void> {
		return this.update((settings) => deleteFolder(settings, folderPath));
	}

	/** Wait for currently queued I/O to settle; individual mutation promises report write errors. */
	flush(): Promise<void> {
		return this.queue;
	}

	/** Cancel queued edits and release cached identities/listeners; an active host write cannot be canceled. */
	dispose(): void {
		this.disposed = true;
		this.generation++;
		this.cache.clear();
		this.listeners.clear();
	}

	/** Validate the host read, failing read-only if data.json is unreadable or malformed JSON. */
	private async read(): Promise<SettingsRead> {
		try {
			return readSettings(await this.storage.loadData());
		} catch {
			return {
				settings: defaultSettings(),
				status: 'load-error',
				writable: false,
			};
		}
	}

	/** Install loaded data and its comparison baseline without automatically saving migrations or repairs. */
	private install(loaded: SettingsRead): void {
		this.current = loaded;
		this.diskFingerprint = JSON.stringify(loaded.settings);
		this.writeError = null;
		this.invalidate();
	}

	/** Publish persistence state as well as model changes without discarding cached identities. */
	private notify(): void {
		for (const listener of this.listeners) listener();
	}

	/** Reject edits with an obsolete generation after an external reload request. */
	private requireCurrent(generation: number): void {
		if (this.disposed)
			throw new Error('The color plugin has been unloaded.');
		if (generation !== this.generation)
			throw new Error(
				'Color settings changed externally; retry the edit.',
			);
	}

	/** Queue operation after preceding I/O; failure rejects its caller without poisoning later operations. */
	private enqueue(operation: () => Promise<void>): Promise<void> {
		const pending = this.queue.then(operation);
		this.queue = pending.catch(() => {});
		return pending;
	}
}
