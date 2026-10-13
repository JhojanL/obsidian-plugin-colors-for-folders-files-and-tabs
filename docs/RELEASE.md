# Releases

This guide covers release configuration, publication and Obsidian submission for
`JhojanL/obsidian-plugin-colors-for-folders-files-and-tabs`. For local setup and
Windows deployment, see [DEVELOPMENT.md](DEVELOPMENT.md). Verification requirements
and native-test limitations remain in [TESTING.md](TESTING.md).

## Current status

On 2026-10-12, GitHub's API confirmed the public repository uses `main`, the
`Protect main` ruleset is active, and private vulnerability reporting is enabled.
The maintainer configured GitHub Actions and the `RELEASE_PLEASE_TOKEN` secret.

The initial [0.1.0 release](https://github.com/JhojanL/obsidian-plugin-colors-for-folders-files-and-tabs/releases/tag/0.1.0)
is published with `main.js`, `manifest.json` and `styles.css`. Its tag points to
commit `9d23704ad0e53b5ea4997ffa5d86d3b42c2d758b`.

The bootstrap configuration was merged in PR #2. The first enabled preparation
run created [release PR #4 for 0.1.1](https://github.com/JhojanL/obsidian-plugin-colors-for-folders-files-and-tabs/pull/4),
and its push/PR CI runs started, confirming token-driven PR creation and CI
triggering. That run skipped metadata synchronization because the workflow
searched for a shorter branch name than Release Please generated; the recovery
is described below. Token expiry, form previews and notification delivery remain
unverified. Hosted attestation and first generated-release publication remain
pending.
Community-directory submission and approval remain separate steps.

## GitHub configuration

Keep these settings when maintaining the repository:

- **Default branch and merging:** use `main`, enable squash merging, and select
  **Pull request title** as the default squash commit message. Use Conventional
  Commit titles so Release Please can determine the version and changelog.
- **Protect main:** require a PR, resolved review threads and the **build** check.
  The configured ruleset permits squash merges, has zero required approving
  reviews and no bypass actors, and blocks deletion and force pushes. Preparation
  and bootstrap changes follow the same PR process.
- **Actions:** allow `actions/checkout`, `actions/attest`, `jdx/mise-action` and
  `googleapis/release-please-action`. Workflows pin action revisions and the mise
  version. Restricted default workflow permissions can remain in place; the
  release job explicitly requests contents, pull-request, ID-token and attestation
  write permissions. Attestations use GitHub's OIDC identity and `GITHUB_TOKEN`;
  no additional secret is needed for this public repository.
  Tag rules must allow version tags to be created.
- **Repository secret — `RELEASE_PLEASE_TOKEN`:** store a fine-grained PAT scoped
  to this repository with **Contents**, **Pull requests** and **Issues** read/write
  access. Keep it private and track expiry. This workflow requires the dedicated
  token so generated PR updates trigger CI; it does not fall back to
  `GITHUB_TOKEN`. See [GitHub's workflow authentication guidance](https://docs.github.com/en/actions/how-tos/write-workflows/choose-when-workflows-run/trigger-a-workflow).
- **Repository variable — `RELEASE_PLEASE_ENABLED`:** under **Settings → Secrets
  and variables → Actions → Variables**, set it to exactly `true` only after
  [bootstrap](#initial-release-and-bootstrap) is merged. A missing variable or
  value `false` disables release PR preparation. It does not disable the separate
  tag/merged-release-PR publication workflow.
- **Private security reports:** enable **Settings → Advanced Security → Private
  vulnerability reporting**. Keep the issue chooser's private-report URL pointed
  at this repository's `/security/advisories/new`; preview it and the custom form.
  Administrators should use **Watch → Custom → Security alerts** and check email
  notification preferences. Files alone do not enable reporting. See
  [GitHub's setup instructions](https://docs.github.com/en/code-security/how-tos/report-and-fix-vulnerabilities/configure-vulnerability-reporting/configure-for-a-repository).

`GITHUB_TOKEN` is supplied by GitHub Actions for publication. The release workflow
uses it to tag, upload, publish and update PR labels in one run, without relying
on token-created tags to trigger another workflow. Do not store token values in
the repository or this guide.

## Configuration files

| File                                                               | Role                                                                                                                                                |
| ------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------- |
| [release-please-config.json](../release-please-config.json)        | Configures the Node release strategy, bootstrap commit, manifest version update, tags without a component or `v` prefix, and `skip-github-release`. |
| [.release-please-manifest.json](../.release-please-manifest.json)  | Records the package version baseline; initially `0.1.0`. It does not publish anything by itself.                                                    |
| [package.json](../package.json), [manifest.json](../manifest.json) | Keep the package and plugin versions equal. Preserve plugin identity, minimum Obsidian version and desktop-only support.                            |
| [versions.json](../versions.json)                                  | Maps plugin versions to their minimum Obsidian versions; `0.1.0` requires `1.14.4`.                                                                 |
| [version-bump.mjs](../version-bump.mjs)                            | Synchronizes the plugin version and minimum-app mapping during release PR preparation.                                                              |
| [check-release.mjs](../scripts/check-release.mjs)                  | Rejects metadata disagreement and release tags that do not exactly match the `x.y.z` version.                                                       |
| [release-please.yml](../.github/workflows/release-please.yml)      | Creates or updates a release PR on pushes to `main` or manual dispatch, when enabled.                                                               |
| [release.yml](../.github/workflows/release.yml)                    | Builds and publishes the exact merged release commit, or the commit selected by a pushed version tag.                                               |

## Initial release and bootstrap

The one-time initial publication is complete. The maintainer merged the release
preparation PR, then pushed tag `0.1.0` on its reviewed commit. The **Release**
workflow ran the full gate and published the three assets. Continue with normal
commits and PRs; do not recreate that tag or rewrite repository history.

Bootstrap tells Release Please where the first published version ends. The
top-level `bootstrap-sha` excludes that commit and earlier history from the first
generated changelog entry. It must identify the released commit, which can differ
from the repository's first commit.

1. Keep `RELEASE_PLEASE_ENABLED` absent or `false` until the bootstrap PR is merged.
   Leave the separate `RELEASE_PLEASE_TOKEN` secret in place.
2. Verify the baseline with:

   ```bash
   git fetch origin tag 0.1.0
   git rev-parse '0.1.0^{commit}'
   ```

   The expected full SHA is `9d23704ad0e53b5ea4997ffa5d86d3b42c2d758b`. This is
   the `bootstrap-sha` in `release-please-config.json`. Keep the version baseline
   in `.release-please-manifest.json` at `0.1.0`.

3. Merge the bootstrap PR after its final **build** check passes. A suitable PR
   title is `chore: configure release bootstrap`.
4. Create or update the repository **variable** `RELEASE_PLEASE_ENABLED` to `true`.
   Changing a variable does not trigger the workflow. Run **Actions → Prepare
   release PR → Run workflow** on `main`, or let the next push to `main` trigger it.
   With only bootstrap/docs changes since `0.1.0`, no release PR is expected.
5. After the first generated release PR has been merged and published, remove
   `bootstrap-sha` in a maintenance PR. Release Please then uses its release
   history to find the baseline.

No old repository SHA, tag or release is needed. See the official
[bootstrap documentation](https://github.com/googleapis/release-please/blob/main/docs/manifest-releaser.md#bootstrapping).

## Automatic releases

1. Merge ordinary PRs into `main` using Conventional Commit titles. Release Please
   collects releasable changes into a PR on
   `release-please--branches--main--components--colors-for-folders-files-and-tabs`.
   The component suffix comes from the Node package name; disabling components
   in version tags does not remove it from the PR branch. Preparation discovery,
   publication eligibility and label recovery must all match this branch.
2. Review the proposed version, changelog, dates and minimum-app mapping. The
   preparation workflow synchronizes and formats version files. It also finds an
   existing open release PR on unchanged reruns, so interrupted synchronization
   can finish. Wait for **build** on the final generated commit and complete any
   [required native checks](TESTING.md#when-native-checks-are-needed).
3. Merge that release PR when ready to publish. The **Release** workflow requires
   the repository's release branch and `autorelease: pending` label, checks out
   the exact merged commit, validates metadata and runs the full gate.
4. After checks pass, it attests `main.js`, `manifest.json` and `styles.css`,
   creates the exact `x.y.z` tag, uploads `main.js`,
   `manifest.json` and `styles.css` to a draft, and publishes automatically.
   Merging an ordinary preparation or bootstrap PR does not publish a release.
5. After verifying the published release and assets, the workflow replaces
   `autorelease: pending` with `autorelease: tagged` on the release PR.

Finish one release before merging another release PR. Subsequent releases do not
need a manual tag push. Release Please prepares version/changelog PRs; publication
belongs to this repository's separate release workflow.

### Version selection

With the current configuration, starting from `0.1.0`:

| Changes since the previous release        | Proposed version       |
| ----------------------------------------- | ---------------------- |
| `fix: correct folder coloring`            | `0.1.1`                |
| `feat: add a coloring option`             | `0.2.0`                |
| `feat!: introduce an incompatible change` | `1.0.0`                |
| Only `docs:`, `test:` or `chore:` changes | Normally no release PR |

Several changes can share a release; the most significant change determines the
bump. Versions do not roll over at nine: a feature after `0.9.0` can produce
`0.10.0`. Automation classifies commit messages, not product readiness. Review
the proposed version before merging. See the
[Release Please versioning strategy](https://github.com/googleapis/release-please/blob/main/src/versioning-strategies/default.ts).

## Recovery

If a workflow fails, resolve the cause and rerun it. Existing tags must still point
to the checked commit; do not move published tags to bypass a mismatch. An existing
draft resumes its uploads. An already published release is checked without
replacing its assets, then PR label updates are retried. API failures stop the job
rather than being treated as an absent release.

For PR #4, the branch mismatch left `CHANGELOG.md` unformatted and omitted the
`0.1.1` entry from `versions.json`. The repair updates all three branch filters,
formats the changelog and synchronizes the existing release version. Push these
repairs to the existing release PR and wait for **build** on its final commit.
Merging that repaired release PR installs the corrected workflows on `main` and
authorizes publication. Rerunning the original failed CI without those changes
does not repair the generated files.

Local verification of this repair passed the full gate (282 plugin tests and
both release-tooling test files), Actionlint 1.7.12 on all workflows, and eight
simulated publication/recovery scenarios. The three new branch regression checks
failed against the original filters and passed after correction. Hosted **build**
on the repaired PR and subsequent attestation/publication remain pending until
the changes are pushed and the release PR is merged.

The first release verified the publication workflow. The first generated release
PR must separately verify the dedicated token and CI on its final commit. Do not
create live tags/releases merely to test automation.

### Artifact attestations

The release job uses a pinned `actions/attest` revision to record build provenance
for all three checked assets before publication. An attestation failure stops
publication. GitHub stores the signed attestations separately from the three
release downloads. See [GitHub's provenance guidance](https://docs.github.com/en/actions/security-for-github-actions/using-artifact-attestations/using-artifact-attestations-to-establish-provenance-for-builds).

After downloading a release's assets, verify each file:

```bash
gh attestation verify main.js --repo JhojanL/obsidian-plugin-colors-for-folders-files-and-tabs
gh attestation verify manifest.json --repo JhojanL/obsidian-plugin-colors-for-folders-files-and-tabs
gh attestation verify styles.css --repo JhojanL/obsidian-plugin-colors-for-folders-files-and-tabs
```

This workflow change applies to future releases; it does not attest the already
published `0.1.0` assets. Hosted attestation creation and verification remain
**awaiting-manual** until the next authorized release. Keep published assets and
tags unchanged, and verify the downloaded bytes rather than a local rebuild.

## Obsidian submission

Release automation and community-directory submission are separate. Enabling
Release Please does not submit the plugin or establish Obsidian approval.

- [ ] Verify repository links, private reporting, form previews and notifications.
- [ ] Complete bootstrap/token verification and required CI checks for maintenance.
- [ ] Recheck official plugin requirements and the exceptions below; disclose
      platform/theme limitations and resolve any new blocking finding.
- [ ] Confirm package/manifest/tag versions and the `versions.json` mapping agree,
      with all three published assets and accurate release notes.
- [ ] Review README, LICENSE, NOTICE and desktop/minimum-version metadata.
- [ ] After separate maintainer authorization, submit through the Obsidian
      Community directory and address review feedback.

Use [community.obsidian.md](https://community.obsidian.md), sign in with an
Obsidian account, and link the GitHub account that owns the repository. In **Add a
plugin**, enter `https://github.com/JhojanL/obsidian-plugin-colors-for-folders-files-and-tabs`.
The maintainer reviews the developer policies and maintenance commitments before
submitting. The directory reads the manifest from the default branch and uses the
matching GitHub release for installation. See the
[official submission guide](https://docs.obsidian.md/plugins/releasing/submit-plugin).

## Plugin-guideline review

The MVP review checked source and README against the official
[plugin guidelines](https://github.com/obsidianmd/obsidian-developer-docs/blob/main/en/Plugins/Releasing/Plugin%20guidelines.md),
[submission requirements](https://docs.obsidian.md/community-directory/submission-requirements-for-plugins)
and [developer policies](https://docs.obsidian.md/community-directory/developer-policies).
Runtime is offline and metadata-only; no sample functionality, default hotkeys,
unsafe HTML or Node/Electron imports remain. Native settings, registered cleanup,
MIT attribution and preserved desktop/minimum-version metadata were inspected.

Review these exceptions and uncertainties before submission:

| Area                    | Retained behavior and reason                                                                                                                                                                                                                                 |
| ----------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Path normalization      | `normalizeVaultPath` preserves case, whitespace and Unicode while rejecting absolute paths, control characters and parent traversal. It differs from the recommended host `normalizePath`; replacing it requires identity/settings compatibility review.     |
| Settings metadata guard | Adapter `stat` is limited to this plugin's `data.json`, using the host-provided plugin directory. It distinguishes missing data from swallowed read/parse failures while native `loadData`/`saveData` retain bookkeeping. No automatic repair save is added. |
| Host internals          | Guarded tab-header access remains in adapters; unavailable identities/views stay neutral. The scheduling window is acquired after layout readiness. Recheck these assumptions when host versions change.                                                     |
| Dynamic colors          | Namespaced CSS variables carry user/theme colors and measured contrast results; layout and other styling remain in plugin CSS.                                                                                                                               |
| Closed documents        | Earlier tracked cleanup passed, but ownership of two retained closed documents was unresolved. This is not proof of a plugin leak or complete collection.                                                                                                    |

The review found no new blocking runtime defect within the documentation/release scope. It is
not an Obsidian approval; lint alone does not establish complete compliance.
