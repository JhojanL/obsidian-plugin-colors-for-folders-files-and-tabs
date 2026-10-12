import { build, context } from 'esbuild';
import { buildOptions } from './scripts/build-options.mjs';

if (process.argv[2] === 'production') {
	await build(buildOptions({ production: true }));
} else {
	const watcher = await context(buildOptions());
	await watcher.watch();
}
