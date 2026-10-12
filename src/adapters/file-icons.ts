import { setIcon, type IconName } from 'obsidian';
import type { ColorTarget } from './contracts';

const FILE_TYPES: readonly [IconName, readonly string[]][] = [
	[
		'file-text',
		['md', 'markdown', 'txt', 'pdf', 'doc', 'docx', 'odt', 'rtf'],
	],
	[
		'image',
		[
			'avif',
			'bmp',
			'gif',
			'heic',
			'jpeg',
			'jpg',
			'png',
			'svg',
			'tif',
			'tiff',
			'webp',
		],
	],
	[
		'audio-lines',
		['aac', 'aif', 'aiff', 'flac', 'm4a', 'mp3', 'ogg', 'opus', 'wav'],
	],
	['video', ['3gp', 'avi', 'm4v', 'mkv', 'mov', 'mp4', 'ogv', 'webm']],
	['layout-dashboard', ['canvas']],
	['database', ['base', 'csv', 'db', 'sqlite', 'sqlite3']],
];

/** Choose a native icon from target's kind/extension; unrecognized file types share the generic fallback. */
export function fileTypeIcon(target: ColorTarget): IconName {
	if (target.kind === 'folder') return 'folder';
	const filename = target.path.slice(target.path.lastIndexOf('/') + 1);
	const dot = filename.lastIndexOf('.');
	const extension = dot > 0 ? filename.slice(dot + 1).toLowerCase() : '';
	return (
		FILE_TYPES.find(([, extensions]) =>
			extensions.includes(extension),
		)?.[0] ?? 'file'
	);
}

/** Own decorative glyphs while retaining native disclosure arrows, tab icons, labels, and controls. */
export class FileIcons {
	readonly ownedClass: string;

	/** surface selects the native label/container structure and the scoped class hiding the original tab icon. */
	constructor(private readonly surface: 'explorer' | 'tab') {
		this.ownedClass = `cfft-${surface}-icons`;
	}

	/** Reconcile element's decorative icon with identity; null or missing native label structure restores host presentation. */
	render(element: HTMLElement, identity: ColorTarget | null): boolean {
		const parent =
			this.surface === 'tab'
				? element.querySelector<HTMLElement>(
						':scope > .workspace-tab-header-inner',
					)
				: element;
		const label = parent?.querySelector<HTMLElement>(
			this.surface === 'tab'
				? ':scope > .workspace-tab-header-inner-title'
				: ':scope > .nav-folder-title-content, :scope > .nav-file-title-content',
		);
		if (!identity || !parent || !label) {
			this.clear(element);
			return false;
		}
		let icon = parent.querySelector<HTMLElement>(
			':scope > .cfft-type-icon',
		);
		if (!icon) {
			icon = element.ownerDocument.adoptNode(
				createDiv({
					cls:
						this.surface === 'tab'
							? 'workspace-tab-header-inner-icon cfft-type-icon'
							: 'cfft-type-icon',
					attr: { 'aria-hidden': 'true' },
				}),
			);
		}
		if (icon.nextElementSibling !== label) label.before(icon);
		const name = fileTypeIcon(identity);
		if (icon.dataset.cfftIcon !== name || !icon.querySelector('svg')) {
			icon.replaceChildren();
			setIcon(icon, name);
			icon.dataset.cfftIcon = name;
		}
		if (!element.classList.contains(this.ownedClass))
			element.classList.add(this.ownedClass);
		return true;
	}

	/** Remove only glyphs/classes owned on element, revealing its untouched native tab icon. */
	clear(element: HTMLElement): void {
		for (const icon of element.querySelectorAll('.cfft-type-icon'))
			icon.remove();
		if (element.classList.contains(this.ownedClass))
			element.classList.remove(this.ownedClass);
	}
}
