import { getDomWindow } from './contracts';

/** Observe rendered Explorer or tab containers, never an editor or the full document. */
export class ScopedObserver {
	private readonly observers = new Map<HTMLElement, MutationObserver>();

	/** requestRefresh queues a batched render when host structure or identity changes. */
	constructor(private readonly requestRefresh: () => void) {}

	/** Observe connected roots and disconnect containers that the host has replaced. */
	sync(roots: readonly HTMLElement[]): void {
		const current = new Set(roots.filter((root) => root.isConnected));
		for (const [root, observer] of this.observers) {
			if (!current.has(root)) {
				observer.disconnect();
				this.removeInteractions(root);
				this.observers.delete(root);
			}
		}
		for (const root of current) {
			if (this.observers.has(root)) continue;
			const Constructor = getDomWindow(
				root.ownerDocument,
			)?.MutationObserver;
			if (typeof Constructor !== 'function') continue;
			const observer = new Constructor((records) => {
				if (records.length > 0) this.requestRefresh();
			});
			observer.observe(root, {
				subtree: true,
				childList: true,
				attributes: true,
				attributeFilter: [
					'data-path',
					'class',
					'style',
					'aria-selected',
					'aria-current',
				],
			});
			this.observers.set(root, observer);
			for (const event of [
				'pointerover',
				'pointerout',
				'focusin',
				'focusout',
			])
				root.addEventListener(event, this.requestRefresh);
		}
	}

	/**
	 * Call immediately after synchronous reconciliation with a pure resolver.
	 * Pending host changes have been read; discard the renderer's own class writes.
	 */
	settleDecorationWrites(): void {
		for (const observer of this.observers.values()) observer.takeRecords();
	}

	/** Disconnect observers in a closing pop-out document. */
	releaseDocument(doc: Document): void {
		for (const [root, observer] of this.observers) {
			if (root.ownerDocument === doc) {
				observer.disconnect();
				this.removeInteractions(root);
				this.observers.delete(root);
			}
		}
	}

	/** Drop queued records and stop every observer. */
	dispose(): void {
		for (const [root, observer] of this.observers) {
			observer.disconnect();
			this.removeInteractions(root);
		}
		this.observers.clear();
	}

	/** Remove the interaction listeners installed on root alongside its scoped mutation observer. */
	private removeInteractions(root: HTMLElement): void {
		for (const event of [
			'pointerover',
			'pointerout',
			'focusin',
			'focusout',
		])
			root.removeEventListener(event, this.requestRefresh);
	}
}
