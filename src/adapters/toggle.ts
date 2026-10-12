import type { ToggleComponent } from 'obsidian';

/**
 * Reflect value/disabled on toggle and name its checkbox with label; keep the checkbox as the control's tab stop.
 * Native setValue can invoke onChange, so callers must distinguish synchronization from user edits.
 */
export function syncNativeToggle(
	toggle: ToggleComponent,
	label: string,
	value: boolean,
	disabled: boolean,
): void {
	toggle.setValue(value).setDisabled(disabled);
	toggle.toggleEl.setAttribute('aria-label', label);
	toggle.toggleEl.setAttribute('aria-disabled', String(disabled));
	const input = toggle.toggleEl.querySelector<HTMLInputElement>(
		'input[type="checkbox"]',
	);
	if (input) {
		toggle.toggleEl.tabIndex = -1;
		input.tabIndex = 0;
		input.checked = value;
		input.disabled = disabled;
		input.setAttribute('aria-label', label);
	}
}

/** Return toggle's semantic checkbox for focus, falling back to its public element if the host shape differs. */
export function nativeToggleControl(toggle: ToggleComponent): HTMLElement {
	return (
		toggle.toggleEl.querySelector<HTMLInputElement>(
			'input[type="checkbox"]',
		) ?? toggle.toggleEl
	);
}
