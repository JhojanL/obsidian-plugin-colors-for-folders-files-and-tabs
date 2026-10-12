import { Notice, TFolder, type App, type Modal } from 'obsidian';
import { assignFolder, removePaletteColor } from '../model/changes';
import type { PaletteColor } from '../model/types';
import { AssignmentModal } from '../ui/assignment-modal';
import { ColorEditor } from '../ui/color-editor';
import { FolderChooser } from '../ui/folder-chooser';
import { PaletteModal } from '../ui/palette-modal';
import { RemoveColorModal } from '../ui/remove-color-modal';
import { reportSettingsError } from './notices';
import type { SettingsStore } from './store';

/** Route every settings, command, and context-menu flow through one metadata-only settings store. */
export class ColorWorkflow {
	private readonly modals = new Set<Modal>();
	private disposed = false;

	/** app supplies public host metadata/UI APIs; store is the sole model and persistence boundary. */
	constructor(
		readonly app: App,
		readonly store: SettingsStore,
	) {}

	chooseFolder(): void {
		this.show(new FolderChooser(this));
	}

	/** Open assignment controls for path, verifying that its folder still exists at this entry point. */
	openAssignment(path: string): void {
		if (this.disposed) return;
		if (
			!(this.app.vault.getAbstractFileByPath(path) instanceof TFolder) ||
			path === '/' ||
			path === ''
		) {
			new Notice(
				'This folder is no longer available. Choose another folder.',
			);
			return;
		}
		this.show(new AssignmentModal(this, path));
	}

	managePalette(): void {
		this.show(new PaletteModal(this));
	}

	/** Open a cancelable editor for color, or an empty draft when omitted. */
	editColor(color?: PaletteColor): void {
		this.show(new ColorEditor(this, color));
	}

	/** Review paletteId and all currently explicit references before offering removal. */
	removeColor(paletteId: string): void {
		const color = this.store.settings.palette.find(
			(entry) => entry.id === paletteId,
		);
		if (!color) return;
		const references = Object.entries(this.store.settings.assignments)
			.filter(([, id]) => id === paletteId)
			.map(([path]) => path)
			.sort();
		this.show(new RemoveColorModal(this, color, references));
	}

	/** Assign paletteId to path after rechecking metadata at mutation time; null also clears missing-folder references. */
	assign(path: string, paletteId: string | null): Promise<void> {
		return this.store.update((settings) => {
			if (
				paletteId !== null &&
				!(this.app.vault.getAbstractFileByPath(path) instanceof TFolder)
			)
				throw new Error(
					'This folder moved or was deleted. Choose it again.',
				);
			return assignFolder(settings, path, paletteId);
		});
	}

	/** Delete paletteId only after reviewedReferences still matches the latest disk/model assignments. */
	deleteColor(
		paletteId: string,
		reviewedReferences: readonly string[],
	): Promise<void> {
		return this.store.update((settings) => {
			const references = Object.entries(settings.assignments)
				.filter(([, id]) => id === paletteId)
				.map(([path]) => path)
				.sort();
			if (
				JSON.stringify(references) !==
				JSON.stringify(reviewedReferences)
			)
				throw new Error(
					'Folder references changed. Close this dialog and review the removal again.',
				);
			return removePaletteColor(settings, paletteId);
		});
	}

	/** Clear path directly from its context menu, reporting a recoverable failure through the shared notice. */
	async clearFromMenu(path: string): Promise<void> {
		try {
			await this.assign(path, null);
		} catch (error) {
			reportSettingsError(error, this.store);
		}
	}

	/** Release dialog from the workflow when its host-owned close lifecycle runs. */
	release(dialog: Modal): void {
		this.modals.delete(dialog);
	}

	/** Close all controls and their subscriptions when the plugin unloads. */
	dispose(): void {
		this.disposed = true;
		for (const dialog of this.modals) dialog.close();
		this.modals.clear();
	}

	/** Track dialog before opening so unload always reaches its cleanup, including nested palette dialogs. */
	private show(dialog: Modal): void {
		if (this.disposed) return;
		this.modals.add(dialog);
		dialog.open();
	}
}
