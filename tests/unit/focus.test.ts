import { afterEach, describe, expect, it, vi } from 'vitest';
import { captureFocus } from '../../src/ui/focus';

afterEach(() => document.body.replaceChildren());

describe('focus recovery', () => {
	it.each([
		{
			label: 'hidden control',
			attribute: 'hidden',
			value: '',
			ancestor: false,
		},
		{
			label: 'hidden ancestor',
			attribute: 'hidden',
			value: '',
			ancestor: true,
		},
		{
			label: 'disabled tabindex control',
			attribute: 'disabled',
			value: '',
			ancestor: false,
		},
		{
			label: 'aria-disabled control',
			attribute: 'aria-disabled',
			value: 'true',
			ancestor: false,
		},
		{
			label: 'aria-disabled ancestor',
			attribute: 'aria-disabled',
			value: 'true',
			ancestor: true,
		},
		{
			label: 'CSS-hidden ancestor',
			attribute: 'style',
			value: 'display: none',
			ancestor: true,
		},
		{
			label: 'invisible control',
			attribute: 'style',
			value: 'visibility: hidden',
			ancestor: false,
		},
	])(
		'skips a $label before an eligible fallback',
		({ attribute, value, ancestor }) => {
			const root = document.createElement('div');
			root.className = 'cfft-controls';
			const unavailable = document.createElement('button');
			unavailable.tabIndex = 0;
			const boundary = ancestor
				? document.createElement('div')
				: unavailable;
			boundary.setAttribute(attribute, value);
			if (ancestor) boundary.append(unavailable);
			const available = document.createElement('button');
			const trigger = document.createElement('button');
			trigger.dataset.cfftFocus = 'trigger';
			root.append(boundary, available, trigger);
			document.body.append(root);
			trigger.focus();
			const focus = captureFocus(document);
			trigger.remove();
			focus.restore();
			expect(document.activeElement).toBe(available);
		},
	);

	it('leaves focus alone when no eligible fallback remains', () => {
		const root = document.createElement('div');
		root.className = 'cfft-controls';
		const hidden = document.createElement('button');
		hidden.hidden = true;
		const trigger = document.createElement('button');
		root.append(hidden, trigger);
		document.body.append(root);
		trigger.focus();
		const focus = captureFocus(document);
		trigger.remove();
		const attempted = vi.spyOn(hidden, 'focus');
		focus.restore();
		expect(attempted).not.toHaveBeenCalled();
		expect(document.activeElement).toBe(document.body);
	});
});
