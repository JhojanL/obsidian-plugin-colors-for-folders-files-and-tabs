import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

// Observed on GitHub PR #4, independently of the workflow's branch filters.
const generatedBranch =
	'release-please--branches--main--components--colors-for-folders-files-and-tabs';

/** Read the checked-in workflow named file; these checks do not contact GitHub. */
function workflow(file) {
	return readFileSync(
		new URL(`../../.github/workflows/${file}`, import.meta.url),
		'utf8',
	);
}

test('release preparation discovers the component branch generated for PR #4', () => {
	const source = workflow('release-please.yml');
	const head = source.match(/--head\s+([\w-]+)/)?.[1];
	assert.equal(
		head,
		generatedBranch,
		'The discovery filter must find the generated release PR.',
	);
});

test('merged release PRs pass the publication branch guard', () => {
	const source = workflow('release.yml');
	const head = source.match(
		/github\.event\.pull_request\.head\.ref == '([^']+)'/,
	)?.[1];
	assert.equal(
		head,
		generatedBranch,
		'The generated release branch must be eligible for publication.',
	);
});

test('published release PRs pass the label-recovery branch guard', () => {
	const source = workflow('release.yml');
	const head = source.match(/\.head\.ref == "([^"]+)"/)?.[1];
	assert.equal(
		head,
		generatedBranch,
		'Label recovery must find the same release PR after publication.',
	);
});
