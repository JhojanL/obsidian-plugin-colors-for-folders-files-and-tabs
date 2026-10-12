import { readFileSync } from 'node:fs';

/** Read path relative to the checkout or isolated fixture used as the working directory. */
function readJson(path) {
	return JSON.parse(readFileSync(path, 'utf8'));
}

const packageJson = readJson('package.json');
const manifest = readJson('manifest.json');
const versions = readJson('versions.json');
const releaseManifest = readJson('.release-please-manifest.json');
const version = packageJson.version;
const exactVersion = /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/;

if (typeof version !== 'string' || !exactVersion.test(version)) {
	throw new Error('The package version must be an exact x.y.z version.');
}
if (manifest.version !== version) {
	throw new Error('Package and Obsidian manifest versions must match.');
}
if (releaseManifest['.'] !== version) {
	throw new Error(
		'The Release Please manifest must match the package version.',
	);
}
if (
	typeof manifest.minAppVersion !== 'string' ||
	!exactVersion.test(manifest.minAppVersion)
) {
	throw new Error(
		'The minimum Obsidian version must be an exact x.y.z version.',
	);
}
if (
	!Object.hasOwn(versions, version) ||
	versions[version] !== manifest.minAppVersion
) {
	throw new Error(
		'versions.json must map this version to manifest.minAppVersion.',
	);
}

// The optional tag is supplied by release CI; ordinary checks only inspect local metadata.
const tag = process.argv[2];
if (process.argv.length > 3 || (tag !== undefined && tag !== version)) {
	throw new Error(
		'The release tag must exactly match the x.y.z package version, without a v prefix.',
	);
}

process.stdout.write(
	`Release metadata verified: ${version}, Obsidian ${manifest.minAppVersion}.\n`,
);
