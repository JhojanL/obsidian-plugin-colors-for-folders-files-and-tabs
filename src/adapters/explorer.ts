import { isVaultPath, type ColorResolver } from './contracts';
import { Decoration, type DecorationTarget } from './decoration';
import { ScopedObserver } from './scoped-observer';
import type { RenderingPipeline } from './rendering';

const ROW_SELECTOR = '.nav-folder-title[data-path], .nav-file-title[data-path]';

/** Map rendered Explorer titles to full paths without accessing an internal file map. */
export class ExplorerAdapter {
	private readonly decoration: Decoration;
	private readonly observer: ScopedObserver;

	/** resolveColor reads identities; requestRefresh batches changes; rendering shares appearance/colors. */
	constructor(
		resolveColor: ColorResolver,
		requestRefresh: () => void,
		rendering?: RenderingPipeline,
	) {
		this.decoration = new Decoration(
			'cfft-explorer-color',
			resolveColor,
			rendering,
		);
		this.observer = new ScopedObserver(requestRefresh);
	}

	/** Re-read row identities in rendered roots, including recycled rows and renamed paths. */
	refresh(roots: readonly HTMLElement[]): void {
		const connectedRoots = roots.filter((root) => root.isConnected);
		this.observer.sync(connectedRoots);
		const targets: DecorationTarget[] = [];
		for (const root of connectedRoots) {
			for (const element of root.querySelectorAll<HTMLElement>(
				ROW_SELECTOR,
			)) {
				const path = element.getAttribute('data-path') ?? '';
				targets.push({
					element,
					identity: isVaultPath(path)
						? {
								path,
								kind: element.matches('.nav-folder-title')
									? 'folder'
									: 'file',
							}
						: null,
				});
			}
		}
		this.decoration.render(targets, connectedRoots);
		this.observer.settleDecorationWrites();
	}

	/** Discard shared-batch foreground writes after both Explorer and tabs have finished committing. */
	settleDecorationWrites(): void {
		this.observer.settleDecorationWrites();
	}

	/** Remove observers and owned styles from a closing document. */
	releaseDocument(doc: Document): void {
		this.observer.releaseDocument(doc);
		this.decoration.releaseDocument(doc);
	}

	/** Stop refreshes and restore all decorated rows. */
	dispose(): void {
		this.observer.dispose();
		this.decoration.dispose();
	}
}
