import { SuggestModal, TFolder } from 'obsidian';
import type { ColorWorkflow } from '../settings/workflow';

/** Search loaded folder metadata, including folders with no open note, using Obsidian's native suggester. */
export class FolderChooser extends SuggestModal<TFolder> {
	/** workflow supplies the vault and opens the assignment dialog after a native selection. */
	constructor(private readonly workflow: ColorWorkflow) {
		super(workflow.app);
		this.setPlaceholder('Choose a folder…');
		this.inputEl.setAttribute('aria-label', 'Choose a folder');
		this.emptyStateText = 'No matching folders.';
		this.setInstructions([
			{ command: '↑↓', purpose: 'Choose a folder' },
			{ command: '↵', purpose: 'Set folder color' },
			{ command: 'esc', purpose: 'Cancel' },
		]);
	}

	/** Match query against full, non-root folder paths without reading any note body. */
	getSuggestions(query: string): TFolder[] {
		const needle = query.trim().toLocaleLowerCase();
		return this.app.vault
			.getAllLoadedFiles()
			.filter(
				(file): file is TFolder =>
					file instanceof TFolder &&
					file.path !== '/' &&
					file.path !== '' &&
					file.path.toLocaleLowerCase().includes(needle),
			)
			.sort((a, b) => a.path.localeCompare(b.path));
	}

	/** Show folder's unabridged path in element, so duplicate basenames stay distinguishable. */
	renderSuggestion(folder: TFolder, element: HTMLElement): void {
		element.setText(folder.path);
		element.addClass('cfft-folder-path');
	}

	/** Queue folder's assignment dialog until the native suggester has completed its close/focus cycle. */
	onChooseSuggestion(folder: TFolder): void {
		queueMicrotask(() => this.workflow.openAssignment(folder.path));
	}

	onClose(): void {
		super.onClose();
		this.workflow.release(this);
	}
}
