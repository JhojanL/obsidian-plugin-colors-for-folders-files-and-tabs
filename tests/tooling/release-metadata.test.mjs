import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const checkScript = fileURLToPath(
	new URL('../../scripts/check-release.mjs', import.meta.url),
);
const bumpScript = fileURLToPath(
	new URL('../../version-bump.mjs', import.meta.url),
);

/** context owns cleanup; overrides replaces individual metadata files in a synthetic checkout. */
function fixture(context, overrides = {}) {
	const directory = mkdtempSync(join(tmpdir(), 'cfft-release-'));
	context.after(() => rmSync(directory, { recursive: true, force: true }));
	const files = {
		'package.json': { version: '0.1.0' },
		'manifest.json': { version: '0.1.0', minAppVersion: '1.14.4' },
		'versions.json': { '0.1.0': '1.14.4' },
		'.release-please-manifest.json': { '.': '0.1.0' },
		...overrides,
	};
	for (const [name, value] of Object.entries(files)) {
		writeFileSync(join(directory, name), JSON.stringify(value));
	}
	return directory;
}

/** directory is the synthetic cwd; script is an absolute entry point; args/env supply CLI inputs without a shell. */
function runScript(directory, script = checkScript, args = [], env = {}) {
	return spawnSync(process.execPath, [script, ...args], {
		cwd: directory,
		encoding: 'utf8',
		env: { ...process.env, ...env },
	});
}

test('valid release metadata and matching tag pass without modifying files', (context) => {
	const directory = fixture(context);
	const names = [
		'package.json',
		'manifest.json',
		'versions.json',
		'.release-please-manifest.json',
	];
	const before = names.map((name) =>
		readFileSync(join(directory, name), 'utf8'),
	);
	assert.equal(runScript(directory).status, 0);
	assert.equal(runScript(directory, checkScript, ['0.1.0']).status, 0);
	assert.deepEqual(
		names.map((name) => readFileSync(join(directory, name), 'utf8')),
		before,
	);
});

test('mismatched plugin version is rejected', (context) => {
	const directory = fixture(context, {
		'manifest.json': { version: '0.2.0', minAppVersion: '1.14.4' },
	});
	const result = runScript(directory);
	assert.notEqual(result.status, 0);
	assert.match(result.stderr, /manifest versions must match/);
});

test('stale Release Please version is rejected', (context) => {
	const directory = fixture(context, {
		'.release-please-manifest.json': { '.': '0.0.0' },
	});
	const result = runScript(directory);
	assert.notEqual(result.status, 0);
	assert.match(result.stderr, /Release Please manifest must match/);
});

test('missing and incorrect minimum-app mappings are rejected', (context) => {
	for (const versions of [{}, { '0.1.0': '1.13.1' }]) {
		const directory = fixture(context, { 'versions.json': versions });
		const result = runScript(directory);
		assert.notEqual(result.status, 0);
		assert.match(result.stderr, /versions.json must map/);
	}
});

test('invalid package and minimum-app versions are rejected', (context) => {
	for (const version of ['v0.1.0', '0.1.0-beta.1', '00.1.0', 1, null]) {
		const directory = fixture(context, { 'package.json': { version } });
		const result = runScript(directory);
		assert.notEqual(result.status, 0);
		assert.match(result.stderr, /package version must be an exact/);
	}
	const directory = fixture(context, {
		'manifest.json': { version: '0.1.0', minAppVersion: '1.14' },
	});
	const result = runScript(directory);
	assert.notEqual(result.status, 0);
	assert.match(result.stderr, /minimum Obsidian version must be an exact/);
});

test('prefixed, mismatched, prerelease and additional tag arguments are rejected', (context) => {
	const directory = fixture(context);
	for (const args of [
		['v0.1.0'],
		['0.2.0'],
		['0.1.0-beta.1'],
		['0.1.0', 'extra'],
	]) {
		const result = runScript(directory, checkScript, args);
		assert.notEqual(result.status, 0);
		assert.match(result.stderr, /release tag must exactly match/);
	}
});

test('bot synchronization adds the next minimum-app mapping and preserves prior entries', (context) => {
	const directory = fixture(context, {
		'package.json': { version: '0.2.0' },
		'manifest.json': { version: '0.2.0', minAppVersion: '1.14.4' },
		'.release-please-manifest.json': { '.': '0.2.0' },
	});
	assert.notEqual(runScript(directory).status, 0);
	const result = runScript(directory, bumpScript, [], {
		npm_package_version: '0.2.0',
	});
	assert.equal(result.status, 0, result.stderr);
	assert.deepEqual(
		JSON.parse(readFileSync(join(directory, 'versions.json'), 'utf8')),
		{
			'0.1.0': '1.14.4',
			'0.2.0': '1.14.4',
		},
	);
	assert.equal(runScript(directory, checkScript, ['0.2.0']).status, 0);
});
