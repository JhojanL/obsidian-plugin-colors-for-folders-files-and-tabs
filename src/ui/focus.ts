export interface FocusReturn {
	/** Restore an eligible original/replacement or the first usable control; no candidate leaves focus unchanged. */
	restore(): void;
}

/** Capture doc's active control before opening or rebuilding a view; keys survive model refreshes. */
export function captureFocus(doc: Document): FocusReturn {
	const active = doc.activeElement as HTMLElement | null;
	const element = active?.closest<HTMLElement>('[data-cfft-focus]') ?? active;
	const root = element?.closest('.cfft-controls');
	const key = element?.getAttribute('data-cfft-focus');
	return {
		restore: () => {
			const replacement = key
				? Array.from(
						root?.querySelectorAll<HTMLElement>(
							'[data-cfft-focus]',
						) ?? [],
					).find((candidate) => candidate.dataset.cfftFocus === key)
				: null;
			const candidates = [
				element,
				replacement,
				...Array.from(
					root?.querySelectorAll<HTMLElement>(
						'button, input, select, textarea, a[href], [tabindex="0"]',
					) ?? [],
				).filter((candidate) => candidate.tabIndex >= 0),
			];
			candidates
				.find((candidate) => canRestoreFocus(candidate, doc))
				?.focus();
		},
	};
}

/** Check element and its ancestors for availability in the originating doc, including CSS-only hiding. */
function canRestoreFocus(
	element: HTMLElement | null | undefined,
	doc: Document,
): element is HTMLElement {
	if (
		!element?.isConnected ||
		element.ownerDocument !== doc ||
		element.matches(':disabled, input[type="hidden"]') ||
		element.closest(
			'[hidden], [inert], [aria-hidden="true"], [aria-disabled="true"]',
		)
	)
		return false;
	for (
		let ancestor: HTMLElement | null = element;
		ancestor;
		ancestor = ancestor.parentElement
	) {
		const style = doc.defaultView?.getComputedStyle(ancestor);
		if (
			style?.display === 'none' ||
			style?.visibility === 'hidden' ||
			style?.visibility === 'collapse'
		)
			return false;
	}
	return true;
}
