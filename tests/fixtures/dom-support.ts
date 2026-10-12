/** Apply styles' CSS property/value pairs to element for theme fixtures; real rendering is verified separately. */
export function setHostStyles(
	element: HTMLElement,
	styles: Readonly<Record<string, string>>,
): void {
	for (const [property, value] of Object.entries(styles))
		element.style.setProperty(property, value);
}

/** Install host DOM helpers for this fixture scope; restore them after disposing components and observers. */
export function installObsidianDom(): () => void {
	const originals: {
		prototype: object;
		name: string;
		descriptor: PropertyDescriptor | undefined;
	}[] = [];
	/** Temporarily install method under name on prototype, retaining its original descriptor for restoration. */
	const define = (prototype: object, name: string, method: unknown): void => {
		originals.push({
			prototype,
			name,
			descriptor: Object.getOwnPropertyDescriptor(prototype, name),
		});
		Object.defineProperty(prototype, name, {
			configurable: true,
			value: method,
		});
	};
	/** Append tag to this node with info's classes/text/attributes; omitted info creates a bare element. */
	function createElement<K extends keyof HTMLElementTagNameMap>(
		this: Node,
		tag: K,
		info: DomElementInfo = {},
	): HTMLElementTagNameMap[K] {
		const element = (this.ownerDocument ?? document).createElement(tag);
		if (info.cls)
			element.className = Array.isArray(info.cls)
				? info.cls.join(' ')
				: info.cls;
		if (typeof info.text === 'string') element.textContent = info.text;
		else if (info.text) element.appendChild(info.text);
		for (const [name, value] of Object.entries(info.attr ?? {}))
			element.setAttribute(name, String(value));
		this.appendChild(element);
		return element;
	}
	define(Node.prototype, 'createEl', createElement);
	define(window, 'createDiv', (info: DomElementInfo = {}) =>
		createElement.call(document.createDocumentFragment(), 'div', info),
	);
	define(Document.prototype, 'win', window);
	define(window, 'activeDocument', document);
	define(
		Node.prototype,
		'createDiv',
		function (this: Node, info: DomElementInfo) {
			return createElement.call(this, 'div', info);
		},
	);
	define(
		Node.prototype,
		'createSpan',
		function (this: Node, info: DomElementInfo) {
			return createElement.call(this, 'span', info);
		},
	);
	define(Node.prototype, 'empty', function (this: Node) {
		this.textContent = '';
	});
	define(
		Element.prototype,
		'addClass',
		function (this: Element, ...classes: string[]) {
			this.classList.add(...classes);
		},
	);
	define(
		Element.prototype,
		'setText',
		function (this: Element, value: string) {
			this.textContent = value;
		},
	);
	return () => {
		for (const { prototype, name, descriptor } of originals) {
			if (descriptor) Object.defineProperty(prototype, name, descriptor);
			else Reflect.deleteProperty(prototype, name);
		}
	};
}

/** Require selector in root before a UI action; fail directly when the intended control is absent. */
export function requireElement<T extends Element = HTMLElement>(
	root: ParentNode,
	selector: string,
): T {
	const element = root.querySelector<T>(selector);
	if (!element) throw new Error(`Missing required element: ${selector}`);
	return element;
}
