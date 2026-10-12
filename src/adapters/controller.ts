import type { ColorResolver, HostSnapshot } from './contracts';
import { ExplorerAdapter } from './explorer';
import { TabAdapter } from './tabs';
import { RenderingPipeline } from './rendering';
import type { ColoringOptions } from '../model/types';

export type FrameScheduler = Pick<
	Window,
	'requestAnimationFrame' | 'cancelAnimationFrame'
>;

/** Coalesce host events and scoped mutations into one render per animation frame. */
export class HostDecorationController {
	private readonly explorer: ExplorerAdapter;
	private readonly tabs: TabAdapter;
	private readonly rendering: RenderingPipeline;
	private readonly closedDocuments = new WeakSet<Document>();
	private frame: number | null = null;
	private started = false;
	private disposed = false;

	/** snapshot reads identities; resolver resolves families; scheduler batches frames; preferences supplies flags. */
	constructor(
		private readonly snapshot: () => HostSnapshot,
		resolver: ColorResolver,
		private readonly scheduler: FrameScheduler,
		preferences?: () => ColoringOptions,
	) {
		this.rendering = new RenderingPipeline(
			this.requestRefresh,
			preferences,
		);
		this.explorer = new ExplorerAdapter(
			resolver,
			this.requestRefresh,
			this.rendering,
		);
		this.tabs = new TabAdapter(
			resolver,
			this.requestRefresh,
			this.rendering,
		);
	}

	/** Clear the theme revision/cache and request a batched refresh after host CSS changes. */
	readonly invalidateAppearance = (): void => this.rendering.invalidate();

	/** Called after layout is ready; a late host callback cannot restart an unloaded plugin. */
	start(): void {
		if (this.disposed || this.started) return;
		this.started = true;
		this.requestRefresh();
	}

	/** Queue a refresh, coalescing repeated events and ignoring calls after unload. */
	readonly requestRefresh = (): void => {
		if (!this.started || this.disposed || this.frame !== null) return;
		this.frame = this.scheduler.requestAnimationFrame(() => {
			this.frame = null;
			if (this.disposed) return;
			const { explorerRoots, tabs } = this.snapshot();
			this.rendering.batch(() => {
				this.explorer.refresh(
					explorerRoots.filter(
						(root) => !this.closedDocuments.has(root.ownerDocument),
					),
				);
				this.tabs.refresh(
					tabs.filter(
						({ element }) =>
							!this.closedDocuments.has(element.ownerDocument),
					),
				);
			});
			this.explorer.settleDecorationWrites();
			this.tabs.settleDecorationWrites();
		});
	};

	/** Release a closing document before the workspace drops its leaves. */
	releaseDocument(doc: Document): void {
		this.closedDocuments.add(doc);
		this.explorer.releaseDocument(doc);
		this.tabs.releaseDocument(doc);
	}

	/** Cancel queued work, disconnect observers, and remove every owned decoration. */
	dispose(): void {
		this.disposed = true;
		if (this.frame !== null)
			this.scheduler.cancelAnimationFrame(this.frame);
		this.frame = null;
		this.explorer.dispose();
		this.tabs.dispose();
		this.rendering.dispose();
	}
}
