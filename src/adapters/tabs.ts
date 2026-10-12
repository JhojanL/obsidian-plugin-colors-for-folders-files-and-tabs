import { isVaultPath, type ColorResolver, type TabTarget } from './contracts';
import { Decoration } from './decoration';
import { ScopedObserver } from './scoped-observer';
import type { RenderingPipeline } from './rendering';

/** Decorate headers already paired with real leaf identities by the host bridge. */
export class TabAdapter {
	private readonly decoration: Decoration;
	private readonly observer: ScopedObserver;

	/** resolveColor reads identities; requestRefresh batches changes; rendering shares appearance/colors. */
	constructor(
		resolveColor: ColorResolver,
		requestRefresh: () => void,
		rendering?: RenderingPipeline,
	) {
		this.decoration = new Decoration(
			'cfft-tab-color',
			resolveColor,
			rendering,
		);
		this.observer = new ScopedObserver(requestRefresh);
	}

	/** Refresh all matching file tabs and clear reused headers that now hold non-file views. */
	refresh(tabs: readonly TabTarget[]): void {
		const connectedTabs = tabs.filter(({ element }) => element.isConnected);
		const roots = new Set<HTMLElement>();
		for (const { element } of connectedTabs) {
			const root = element.closest<HTMLElement>(
				'.workspace-tab-header-container',
			);
			if (root) roots.add(root);
		}
		this.observer.sync([...roots]);
		this.decoration.render(
			connectedTabs.map(({ element, filePath }) => ({
				element,
				identity:
					filePath && isVaultPath(filePath)
						? { path: filePath, kind: 'file' }
						: null,
			})),
			[...roots],
		);
		this.observer.settleDecorationWrites();
	}

	/** Discard shared-batch foreground writes after both Explorer and tabs have finished committing. */
	settleDecorationWrites(): void {
		this.observer.settleDecorationWrites();
	}

	/** Remove observers and owned styles from a closing pop-out document. */
	releaseDocument(doc: Document): void {
		this.observer.releaseDocument(doc);
		this.decoration.releaseDocument(doc);
	}

	/** Restore tracked headers and any copies made by host tab animations. */
	dispose(): void {
		this.observer.dispose();
		this.decoration.dispose();
	}
}
