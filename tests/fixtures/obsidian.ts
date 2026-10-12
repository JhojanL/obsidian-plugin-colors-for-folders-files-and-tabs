/** Minimal metadata-only runtime boundary; fixtures do not establish host compatibility. */
export {
	Component,
	ButtonComponent,
	Setting,
	Modal,
	SuggestModal,
	PluginSettingTab,
} from './ui-controls';

export class FileView {
	file: { path: string } | null;

	/** path is the current file identity, or null for a file view without an open file. */
	constructor(path: string | null) {
		this.file = path === null ? null : { path };
	}
}

/** Metadata object for the integration's vault lookup; no note body is present. */
export class TFile {
	/** path is a full vault-relative file path. */
	constructor(readonly path: string) {}
}

/** A folder metadata identity for public vault rename/delete callbacks. */
export class TFolder {
	/** path is the folder's current vault-relative identity. */
	constructor(readonly path: string) {}
}

/** Capture only notice text; fixtures do not render or verify Obsidian notices. */
export class Notice {
	static readonly messages: string[] = [];

	/** message is the user-facing result of an actual settings failure. */
	constructor(message: string) {
		Notice.messages.push(message);
	}
}

/** Record the native setIcon contract on parent; host checks verify the actual built-in glyphs. */
export function setIcon(parent: HTMLElement, iconId: string): void {
	const svg = parent.ownerDocument.createElementNS(
		'http://www.w3.org/2000/svg',
		'svg',
	);
	svg.classList.add('svg-icon', `lucide-${iconId}`);
	parent.replaceChildren(svg);
}
