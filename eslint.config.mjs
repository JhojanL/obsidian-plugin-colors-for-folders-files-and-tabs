import { builtinModules } from 'node:module';
import obsidianmd from './tooling/eslint/obsidian-plugin.mjs';
import globals from 'globals';
import { defineConfig, globalIgnores } from 'eslint/config';

export default defineConfig(
	globalIgnores([
		'node_modules/**',
		'dist/**',
		'coverage/**',
		'main.js',
		'.dev-build-*/**',
	]),
	...obsidianmd.configs.recommended,
	{
		files: ['**/*.mjs'],
		languageOptions: {
			globals: globals.node,
			parserOptions: { projectService: false },
		},
		rules: {
			// Build tools have no Vault instance; deployment accepts an explicit config directory.
			'obsidianmd/hardcoded-config-path': 'off',
			// Host networking advice applies to plugin runtime, not local build tools.
			'no-restricted-globals': 'off',
		},
	},
	{
		files: [
			'tests/unit/**/*.ts',
			'tests/fixtures/**/*.ts',
			'vitest.config.ts',
		],
		languageOptions: {
			parserOptions: {
				projectService: false,
				project: './tsconfig.tests.json',
				tsconfigRootDir: import.meta.dirname,
			},
		},
		rules: {
			// jsdom supplies native DOM APIs without Obsidian's createEl/createDiv extensions.
			'obsidianmd/prefer-create-el': 'off',
		},
	},
	{
		files: ['src/**/*.ts'],
		languageOptions: {
			parserOptions: {
				projectService: true,
				tsconfigRootDir: import.meta.dirname,
			},
		},
		rules: {
			'@typescript-eslint/no-restricted-imports': [
				'error',
				{
					paths: [
						...new Set([...builtinModules, 'electron']),
						{
							name: 'obsidian',
							importNames: ['request', 'requestUrl'],
							message: 'Plugin runtime must remain offline.',
						},
					],
					patterns: ['node:*'],
				},
			],
			'no-restricted-globals': [
				'error',
				'fetch',
				'XMLHttpRequest',
				'WebSocket',
				'EventSource',
				'ajax',
				'ajaxPromise',
			],
			'no-restricted-syntax': [
				'error',
				{
					selector:
						'MemberExpression[property.name=/^(fetch|XMLHttpRequest|WebSocket|EventSource|requestUrl|ajax|ajaxPromise)$/]',
					message: 'Plugin runtime must remain offline.',
				},
			],
		},
	},
);
