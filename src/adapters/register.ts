import { TFile, type Plugin } from 'obsidian';
import type { ColorResolver } from './contracts';
import { HostDecorationController } from './controller';
import { readHostSnapshot } from './host';
import type { ColoringOptions } from '../model/types';

/** Register plugin's adapters with resolver and optional preferences; return the batched refresh callback. */
export function registerHostIntegration(
	plugin: Plugin,
	resolver: ColorResolver,
	preferences?: () => ColoringOptions,
): () => void {
	const { workspace, vault } = plugin.app;
	// Cold startup restores the root split after onload; retain its window once layout is ready.
	let schedulingWindow: Window | undefined;
	const controller = new HostDecorationController(
		() =>
			readHostSnapshot(
				workspace,
				(path) => vault.getAbstractFileByPath(path) instanceof TFile,
			),
		resolver,
		{
			requestAnimationFrame: (callback) => {
				schedulingWindow ??= workspace.rootSplit.win;
				return schedulingWindow.requestAnimationFrame(callback);
			},
			cancelAnimationFrame: (handle) =>
				schedulingWindow?.cancelAnimationFrame(handle),
		},
		preferences,
	);
	plugin.register(() => controller.dispose());
	const refresh = controller.requestRefresh;
	plugin.registerEvent(workspace.on('layout-change', refresh));
	plugin.registerEvent(workspace.on('file-open', refresh));
	plugin.registerEvent(workspace.on('active-leaf-change', refresh));
	plugin.registerEvent(
		workspace.on('css-change', controller.invalidateAppearance),
	);
	plugin.registerEvent(workspace.on('window-open', refresh));
	plugin.registerEvent(
		workspace.on('window-close', (container) => {
			controller.releaseDocument(container.doc);
			refresh();
		}),
	);
	plugin.registerEvent(vault.on('create', refresh));
	plugin.registerEvent(vault.on('rename', refresh));
	plugin.registerEvent(vault.on('delete', refresh));
	workspace.onLayoutReady(() => controller.start());
	return refresh;
}
