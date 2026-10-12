import type {
	App,
	ExtraButtonComponent,
	Plugin,
	SearchComponent,
	Setting as NativeSetting,
	SettingDefinitionItem,
	SettingGroup as NativeSettingGroup,
} from 'obsidian';

/** Emulate only public control/lifecycle contracts; native host behavior is verified separately. */
export class Component {
	private loaded = false;
	private readonly children: Component[] = [];
	private readonly cleanups: (() => void)[] = [];
	onload(): void {}
	load(): void {
		if (this.loaded) return;
		this.loaded = true;
		this.onload();
		for (const child of this.children) child.load();
	}
	unload(): void {
		if (!this.loaded) return;
		this.loaded = false;
		for (const child of this.children) child.unload();
		for (const cleanup of this.cleanups.splice(0).reverse()) cleanup();
	}
	/** Register cleanup using the same ownership boundary as the real component. */
	register(cleanup: () => void): void {
		this.cleanups.push(cleanup);
	}
	/** Fixtures represent eventRef by its release callback. */
	registerEvent(eventRef: () => void): void {
		this.register(eventRef);
	}
	/** Own element's callback for type until unload; options preserves capture-phase behavior. */
	registerDomEvent(
		element: HTMLElement,
		type: string,
		callback: EventListener,
		options?: boolean | AddEventListenerOptions,
	): void {
		element.addEventListener(type, callback, options);
		this.register(() =>
			element.removeEventListener(type, callback, options),
		);
	}
	/** Retain child and load it immediately when its parent is already active. */
	addChild<T extends Component>(child: T): T {
		this.children.push(child);
		if (this.loaded) child.load();
		return child;
	}
}

/** Native button facade: event callbacks and disabled state are enough to test workflow behavior. */
export class ButtonComponent {
	readonly buttonEl: HTMLButtonElement;
	/** parent owns the fixture control's DOM. */
	constructor(parent: HTMLElement) {
		this.buttonEl = document.createElement('button');
		parent.append(this.buttonEl);
	}
	/** Render text using DOM text, never HTML. */
	setButtonText(text: string): this {
		this.buttonEl.textContent = text;
		return this;
	}
	/** Reflect disabled on the real native fixture element. */
	setDisabled(disabled: boolean): this {
		this.buttonEl.disabled = disabled;
		return this;
	}
	setCta(): this {
		this.buttonEl.classList.add('mod-cta');
		return this;
	}
	/** Icon rendering belongs to the real host; the button retains native event and label behavior. */
	setIcon(_icon: string): this {
		return this;
	}
	/** Preserve a tooltip while accessible names are supplied by the tested component. */
	setTooltip(tooltip: string): this {
		this.buttonEl.title = tooltip;
		return this;
	}
	setWarning(): this {
		return this;
	}
	/** Destructive styling is verified in the host; retain the fluent native button contract. */
	setDestructive(): this {
		return this;
	}
	/** Route native click to callback, matching the host component contract. */
	onClick(callback: () => unknown): this {
		this.buttonEl.addEventListener('click', () => {
			void callback();
		});
		return this;
	}
}

/** Input facade shared by the named text field and native color picker. */
export class TextComponent {
	readonly inputEl: HTMLInputElement;
	/** parent owns the fixture input; type distinguishes text from native color input. */
	constructor(parent: HTMLElement, type = 'text') {
		this.inputEl = document.createElement('input');
		this.inputEl.type = type;
		parent.append(this.inputEl);
	}
	/** Synchronize value without dispatching a user change event. */
	setValue(value: string): this {
		this.inputEl.value = value;
		return this;
	}
	/** Deliver the user's current value on native input events. */
	onChange(callback: (value: string) => unknown): this {
		this.inputEl.addEventListener('input', () => {
			void callback(this.inputEl.value);
		});
		return this;
	}
}

export class ColorComponent extends TextComponent {
	private changeCallback: ((value: string) => unknown) | undefined;

	/** parent owns the native color input. */
	constructor(parent: HTMLElement) {
		super(parent, 'color');
	}

	/** Match the host: a changed programmatic value also invokes the registered callback. */
	setValue(value: string): this {
		if (this.inputEl.value !== value) {
			super.setValue(value);
			void this.changeCallback?.(this.inputEl.value);
		}
		return this;
	}

	/** Retain callback for both native input events and programmatic setValue changes. */
	onChange(callback: (value: string) => unknown): this {
		this.changeCallback = callback;
		return super.onChange(callback);
	}
}

export class ToggleComponent {
	readonly toggleEl: HTMLLabelElement;
	private readonly input = document.createElement('input');
	private value = false;
	private disabled = false;
	private changeCallback: ((value: boolean) => unknown) | undefined;
	/** parent owns the observed host label/checkbox shape, including its unsynchronized checked property. */
	constructor(parent: HTMLElement) {
		this.toggleEl = document.createElement('label');
		this.toggleEl.className = 'checkbox-container';
		this.toggleEl.tabIndex = 0;
		this.input.type = 'checkbox';
		this.input.tabIndex = -1;
		this.toggleEl.append(this.input);
		this.toggleEl.addEventListener('change', () => this.onClick());
		this.toggleEl.addEventListener('keydown', (event) => {
			if (event.key === ' ' || event.key === 'Enter') {
				event.preventDefault();
				this.onClick();
			}
		});
		parent.append(this.toggleEl);
	}
	/** Return the component's value, which the native host stores separately from its checkbox. */
	getValue(): boolean {
		return this.value;
	}
	/** Reflect value visually and notify only on changes, including programmatic updates like the host. */
	setValue(value: boolean): this {
		if (this.value !== value) {
			this.value = value;
			this.toggleEl.classList.toggle('is-enabled', value);
			void this.changeCallback?.(value);
		}
		return this;
	}
	/** Reflect disabled on the native component; the adapter synchronizes its nested checkbox. */
	setDisabled(disabled: boolean): this {
		this.disabled = disabled;
		this.toggleEl.classList.toggle('is-disabled', disabled);
		return this;
	}
	/** Activate once unless disabled, matching the public host API used by native keyboard/change events. */
	onClick(): void {
		if (!this.disabled) this.setValue(!this.value);
	}
	/** Retain callback for native activation and programmatic setValue changes. */
	onChange(callback: (value: boolean) => unknown): this {
		this.changeCallback = callback;
		return this;
	}
}

/** Minimal native row shape; accessibility and layout claims must come from real Obsidian. */
export class Setting {
	readonly settingEl: HTMLElement;
	readonly infoEl: HTMLElement;
	readonly controlEl: HTMLElement;
	readonly nameEl: HTMLElement;
	readonly descEl: HTMLElement;
	/** parent owns a row with separate name, description, and native controls. */
	constructor(parent: HTMLElement) {
		this.settingEl = document.createElement('div');
		this.settingEl.className = 'setting-item';
		this.infoEl = document.createElement('div');
		this.infoEl.className = 'setting-item-info';
		this.nameEl = document.createElement('div');
		this.nameEl.className = 'setting-item-name';
		this.descEl = document.createElement('div');
		this.descEl.className = 'setting-item-description';
		this.controlEl = document.createElement('div');
		this.controlEl.className = 'setting-item-control';
		this.infoEl.append(this.nameEl, this.descEl);
		this.settingEl.append(this.infoEl, this.controlEl);
		parent.append(this.settingEl);
	}
	/** Display the row's name safely as text. */
	setName(name: string): this {
		this.nameEl.textContent = name;
		return this;
	}
	/** Display desc safely as text, or consume its fragment nodes like the native control. */
	setDesc(desc: string | DocumentFragment): this {
		this.descEl.replaceChildren(desc);
		return this;
	}
	/** Apply the row's owned CSS class. */
	setClass(cls: string): this {
		this.settingEl.classList.add(cls);
		return this;
	}
	setHeading(): this {
		this.settingEl.classList.add('setting-item-heading');
		return this;
	}
	/** Build the native button described by callback. */
	addButton(callback: (button: ButtonComponent) => unknown): this {
		callback(new ButtonComponent(this.controlEl));
		return this;
	}
	/** Build the text input described by callback. */
	addText(callback: (input: TextComponent) => unknown): this {
		callback(new TextComponent(this.controlEl));
		return this;
	}
	/** Build the color input described by callback. */
	addColorPicker(callback: (input: ColorComponent) => unknown): this {
		callback(new ColorComponent(this.controlEl));
		return this;
	}
	/** Build callback's checkbox, preserving the host row's separate keyboard focus position. */
	addToggle(callback: (toggle: ToggleComponent) => unknown): this {
		this.settingEl.classList.add('mod-toggle');
		this.settingEl.tabIndex = -1;
		callback(new ToggleComponent(this.controlEl));
		return this;
	}
}

/** Public native group facade for rendering declarative callbacks; CSS geometry requires host verification. */
export class SettingGroup implements NativeSettingGroup {
	readonly listEl: HTMLElement;
	private readonly groupEl: HTMLElement;
	private readonly heading: Setting;
	/** parent owns a native heading and card containing the group's setting rows. */
	constructor(parent: HTMLElement) {
		const group = (this.groupEl = document.createElement('div'));
		group.className = 'setting-group';
		parent.append(group);
		this.heading = new Setting(group).setHeading();
		this.listEl = document.createElement('div');
		this.listEl.className = 'setting-items';
		group.append(this.listEl);
	}
	/** Render text or consume its fragment nodes as the heading; empty content removes the header. */
	setHeading(text: string | DocumentFragment): this {
		this.heading.nameEl.replaceChildren(text);
		if (!this.heading.nameEl.textContent) this.heading.settingEl.remove();
		return this;
	}
	/** Apply classes to this group's container, preserving its heading and row list. */
	addClass(...classes: string[]): this {
		this.groupEl.classList.add(...classes);
		return this;
	}
	/** Give cb a fixture row through the native contract; only the controls modeled above are available. */
	addSetting(cb: (setting: NativeSetting) => void): this {
		cb(new Setting(this.listEl) as unknown as NativeSetting);
		return this;
	}
	/** cb would configure a native search input; this fixture does not emulate that control. */
	addSearch(_cb: (component: SearchComponent) => unknown): this {
		throw new Error(
			'Native group search controls require host verification.',
		);
	}
	/** cb would configure a native header action; this fixture does not emulate that control. */
	addExtraButton(_cb: (component: ExtraButtonComponent) => unknown): this {
		throw new Error(
			'Native group header actions require host verification.',
		);
	}
}

/** Emulate dialog open/close only, avoiding claims about native focus trapping or Escape handling. */
export class Modal {
	readonly modalEl = document.createElement('div');
	readonly contentEl = document.createElement('div');
	readonly titleEl = document.createElement('div');
	/** app is the host boundary shared by the workflow. */
	constructor(readonly app: App) {
		this.modalEl.append(this.titleEl, this.contentEl);
	}
	/** Name the dialog through the public host API. */
	setTitle(title: string): this {
		this.titleEl.textContent = title;
		return this;
	}
	open(): void {
		document.body.append(this.modalEl);
		this.onOpen();
	}
	close(): void {
		this.onClose();
		this.modalEl.remove();
	}
	onOpen(): void {}
	onClose(): void {}
}

export class SuggestModal<T> extends Modal {
	readonly inputEl = document.createElement('input');
	emptyStateText = '';
	/** Describe the search input's purpose. */
	setPlaceholder(text: string): void {
		this.inputEl.placeholder = text;
	}
	/** Native instruction rendering is outside this fixture's behavior boundary. */
	setInstructions(
		_instructions: { command: string; purpose: string }[],
	): void {}
	/** Emulate the host's close-before-selection cycle. */
	selectSuggestion(value: T): void {
		this.close();
		this.onChooseSuggestion(value);
	}
	/** Subclasses implement actual folder matching and selection. */
	onChooseSuggestion(_value: T): void {}
}

export class PluginSettingTab {
	readonly containerEl = document.createElement('div');
	/** app and plugin provide the real constructor shape without replacing the model/service. */
	constructor(
		readonly app: App,
		_plugin: Plugin,
	) {
		document.body.append(this.containerEl);
	}
	/** Match the public empty-definition default; test pages invoke custom renderers explicitly. */
	getSettingDefinitions(): SettingDefinitionItem[] {
		return [];
	}
	/** Native display/search cycles are outside this fixture; display is no longer abstract. */
	display(): void {}
	/** The native default has no custom controls or subscriptions to release. */
	hide(): void {}
}
