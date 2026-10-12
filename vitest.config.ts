import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';

export default defineConfig({
	resolve: {
		alias: {
			obsidian: fileURLToPath(
				new URL('./tests/fixtures/obsidian.ts', import.meta.url),
			),
		},
	},
	test: {
		// Bound simultaneous jsdom processes without changing test timeouts.
		maxWorkers: 4,
		environment: 'jsdom',
		include: ['tests/unit/**/*.test.ts'],
		restoreMocks: true,
	},
});
