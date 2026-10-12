import { spawn } from 'node:child_process';
import {
	copyFile,
	lstat,
	mkdir,
	mkdtemp,
	open,
	readFile,
	rename,
	rm,
	writeFile,
} from 'node:fs/promises';
import { isAbsolute, join, parse } from 'node:path';
import { build } from 'esbuild';
import { buildOptions, projectRoot } from './build-options.mjs';

/**
 * Require a real directory, refusing symlink destinations.
 * @param path Directory to inspect.
 * @param create Whether a missing directory may be created; parents must already exist.
 */
async function checkDirectory(path, create = false) {
	let info;
	try {
		info = await lstat(path);
	} catch (error) {
		if (error.code !== 'ENOENT' || !create) throw error;
		await mkdir(path);
		info = await lstat(path);
	}
	if (!info.isDirectory() || info.isSymbolicLink()) {
		throw new Error(
			`Deployment requires a directory without symlinks: ${path}`,
		);
	}
}

/** Run the pinned compiler; a failure prevents all writes to the vault. */
async function typecheck() {
	await new Promise((resolve, reject) => {
		const child = spawn(
			process.execPath,
			[join(projectRoot, 'node_modules/typescript/bin/tsc'), '--noEmit'],
			{ cwd: projectRoot, stdio: 'inherit' },
		);
		child.once('error', reject);
		child.once('close', (code) => {
			if (code === 0) resolve();
			else
				reject(
					new Error(
						'Type checking failed; the vault was not changed.',
					),
				);
		});
	});
}

/** Deploy only fresh, successful artifacts to the explicitly configured test vault. */
async function deploy() {
	const vault = process.env.OBSIDIAN_TEST_VAULT;
	if (!vault || !isAbsolute(vault) || vault === parse(vault).root) {
		throw new Error(
			'Set OBSIDIAN_TEST_VAULT to an existing synthetic vault using an absolute WSL path. ' +
				'Copy .env.local.example to .env.local and edit its path.',
		);
	}
	await checkDirectory(vault);

	const configDir = process.env.OBSIDIAN_CONFIG_DIR ?? '.obsidian';
	if (
		!/^[a-zA-Z0-9._-]+$/.test(configDir) ||
		['.', '..'].includes(configDir)
	) {
		throw new Error(
			'OBSIDIAN_CONFIG_DIR must be a single directory name inside the vault.',
		);
	}
	const manifestText = await readFile(
		join(projectRoot, 'manifest.json'),
		'utf8',
	);
	const manifest = JSON.parse(manifestText);
	if (
		typeof manifest.id !== 'string' ||
		!/^[a-z]+(?:-[a-z]+)*$/.test(manifest.id) ||
		manifest.id.includes('obsidian') ||
		manifest.id.endsWith('plugin')
	) {
		throw new Error(
			'manifest.json must contain a valid Obsidian plugin ID.',
		);
	}

	const lockPath = join(projectRoot, '.dev-deploy.lock');
	let lock;
	try {
		lock = await open(lockPath, 'wx');
	} catch (error) {
		if (error.code !== 'EEXIST') throw error;
		throw new Error(
			'A deployment is already running. If it was interrupted, remove .dev-deploy.lock after checking that it has stopped.',
		);
	}
	let buildDir;
	let stagingDir;
	try {
		await lock.writeFile(`${process.pid}\n`);
		await typecheck();
		buildDir = await mkdtemp(join(projectRoot, '.dev-build-'));
		// A separate output prevents the watch build from changing the bundle being deployed.
		await build(
			buildOptions({
				production: true,
				outfile: join(buildDir, 'main.js'),
			}),
		);

		let styles;
		try {
			styles = await readFile(join(projectRoot, 'styles.css'));
		} catch (error) {
			if (error.code !== 'ENOENT') throw error;
		}

		const configPath = join(vault, configDir);
		const pluginsPath = join(configPath, 'plugins');
		const destination = join(pluginsPath, manifest.id);
		for (const path of [configPath, pluginsPath, destination]) {
			await checkDirectory(path, true);
		}
		stagingDir = await mkdtemp(join(destination, '.deploy-'));
		await copyFile(join(buildDir, 'main.js'), join(stagingDir, 'main.js'));
		await writeFile(join(stagingDir, 'manifest.json'), manifestText);
		if (styles !== undefined)
			await writeFile(join(stagingDir, 'styles.css'), styles);

		await rename(
			join(stagingDir, 'manifest.json'),
			join(destination, 'manifest.json'),
		);
		if (styles !== undefined) {
			await rename(
				join(stagingDir, 'styles.css'),
				join(destination, 'styles.css'),
			);
		}
		// Replace JS last so reloaders see the completed companion artifacts.
		await rename(join(stagingDir, 'main.js'), join(destination, 'main.js'));
		process.stdout.write(
			`Deployed ${manifest.id} to ${destination}\nReload Obsidian to load this build.\n`,
		);
	} finally {
		if (stagingDir) await rm(stagingDir, { recursive: true, force: true });
		if (buildDir) await rm(buildDir, { recursive: true, force: true });
		await lock.close();
		await rm(lockPath);
	}
}

try {
	await deploy();
} catch (error) {
	process.stderr.write(
		`Deployment failed: ${error instanceof Error ? error.message : String(error)}\n`,
	);
	process.exitCode = 1;
}
