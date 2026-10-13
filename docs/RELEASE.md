# Releases

This guide covers maintenance releases, configuration and recovery for
`JhojanL/obsidian-plugin-colors-for-folders-files-and-tabs`. For local setup and
Windows deployment, see [DEVELOPMENT.md](DEVELOPMENT.md). Verification requirements
and native-test limitations remain in [TESTING.md](TESTING.md).

## Current status

On 2026-10-12, GitHub's API confirmed the public repository uses `main`, the
`Protect main` ruleset is active, and private vulnerability reporting is enabled.
The maintainer configured GitHub Actions and the `RELEASE_PLEASE_TOKEN` secret.

The plugin is published in the [Obsidian community directory](https://community.obsidian.md/plugins/colors-for-folders-files-and-tabs),
where its review status is **Passed**. Initial submission is complete.

Release PR #4 is merged, and [0.1.1](https://github.com/JhojanL/obsidian-plugin-colors-for-folders-files-and-tabs/releases/tag/0.1.1)
is published with `main.js`, `manifest.json` and `styles.css`. The
[hosted release run](https://github.com/JhojanL/obsidian-plugin-colors-for-folders-files-and-tabs/actions/runs/38340851730)
passed checks, created attestations, published the assets and updated the release
PR label. GitHub records publication at `2026-10-13T03:16:21Z` (October 12 in Lima).

Independent verification of downloaded assets with `gh attestation verify` remains
**awaiting-manual**. Token expiry, form previews and notification delivery remain
unverified. These checks are separate from the passed Obsidian review.

## GitHub configuration

Keep these settings when maintaining the repository:

- **Default branch and merging:** use `main`, enable squash merging, and select
  **Pull request title** as the default squash commit message. Use Conventional
  Commit titles so Release Please can determine the version and changelog.
- **Protect main:** require a PR, resolved review threads and the **build** check.
  The configured ruleset permits squash merges, has zero required approving
  reviews and no bypass actors, and blocks deletion and force pushes. Release
  configuration changes follow the same PR process.
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
  and variables → Actions → Variables**, keep it set to exactly `true` for release
  PR preparation. Bootstrap is complete. A missing variable or
  value `false` disables release PR preparation. It does not disable the separate
  tag/merged-release-PR publication workflow. Changing the variable does not start
  a run; use **Actions → Prepare release PR → Run workflow** on `main`, or let the
  next push to `main` trigger it.
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
| [.release-please-manifest.json](../.release-please-manifest.json)  | Tracks the package version through release PRs. It does not publish anything by itself.                                                             |
| [package.json](../package.json), [manifest.json](../manifest.json) | Keep the package and plugin versions equal. Preserve plugin identity, minimum Obsidian version and desktop-only support.                            |
| [versions.json](../versions.json)                                  | Maps plugin versions to their minimum Obsidian versions.                                                                                            |
| [version-bump.mjs](../version-bump.mjs)                            | Synchronizes the plugin version and minimum-app mapping during release PR preparation.                                                              |
| [check-release.mjs](../scripts/check-release.mjs)                  | Rejects metadata disagreement and release tags that do not exactly match the `x.y.z` version.                                                       |
| [release-please.yml](../.github/workflows/release-please.yml)      | Creates or updates a release PR on pushes to `main` or manual dispatch, when enabled.                                                               |
| [release.yml](../.github/workflows/release.yml)                    | Builds and publishes the exact merged release commit, or the commit selected by a pushed version tag.                                               |

## Initial release and bootstrap

Initial publication and bootstrap are complete. The maintainer published
[0.1.0](https://github.com/JhojanL/obsidian-plugin-colors-for-folders-files-and-tabs/releases/tag/0.1.0)
from commit `9d23704ad0e53b5ea4997ffa5d86d3b42c2d758b`. PR #2 configured that
commit as `bootstrap-sha` before Release Please was enabled.

The version baseline has since advanced to `0.1.1`. Release Please updates it in
release PRs; do not reset it to `0.1.0` or repeat initial tagging. The configuration
still contains `bootstrap-sha`; its removal remains a separate maintenance change
now that the first generated release is published. See the official
[bootstrap documentation](https://github.com/googleapis/release-please/blob/main/docs/manifest-releaser.md#bootstrapping).

## Automatic releases

1. Merge ordinary PRs into `main` using Conventional Commit titles. Release Please
   collects releasable changes into a PR on
   `release-please--branches--main--components--colors-for-folders-files-and-tabs`.
   The component suffix comes from the Node package name; disabling components
   in version tags does not remove it from the PR branch. Preparation discovery,
   publication eligibility and label recovery must all match this branch.
2. Review the proposed version, changelog, dates and minimum-app mapping. The
   preparation workflow synchronizes and formats version files and `CHANGELOG.md`.
   It also finds an existing open release PR on unchanged reruns, so interrupted synchronization
   can finish. Wait for **build** on the final generated commit and complete any
   [required native checks](TESTING.md#when-native-checks-are-needed).
3. Merge that release PR when ready to publish. The **Release** workflow requires
   the repository's release branch and `autorelease: pending` label, checks out
   the exact merged commit, validates metadata and runs the full gate.
4. After checks pass, it attests `main.js`, `manifest.json` and `styles.css`,
   creates the exact `x.y.z` tag, uploads `main.js`,
   `manifest.json` and `styles.css` to a draft, and publishes automatically.
   Merging an ordinary maintenance PR does not publish a release.
5. After verifying the published release and assets, the workflow replaces
   `autorelease: pending` with `autorelease: tagged` on the release PR.

Finish one release before merging another release PR. Subsequent releases do not
need a manual tag push. Release Please prepares version/changelog PRs; publication
belongs to this repository's separate release workflow.

`CHANGELOG.md` is generated from Conventional Commits in the release PR and lands
on `main` when that PR is merged, before publication. Review the generated entry;
there is no separate manual changelog update after release. GitHub release notes
are generated separately during publication.

### Version selection

For example, starting from `0.1.1` with the current configuration:

| Changes since the previous release        | Proposed version       |
| ----------------------------------------- | ---------------------- |
| `fix: correct folder coloring`            | `0.1.2`                |
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

The first generated release PR (#4) needed a branch-filter repair before merging.
The fix aligned preparation, publication and label recovery with the full component
branch name, formatted `CHANGELOG.md` and added `0.1.1` to `versions.json`.
The repair is merged and publication succeeded; no further repair of that PR is needed.

Local verification passed the full gate (282 plugin tests and both release-tooling
test files), Actionlint 1.7.12 and eight simulated publication/recovery scenarios.
Three branch regression checks failed before the fix and passed afterwards.
Hosted publication results are linked under [current status](#current-status).
Do not create live tags or releases merely to test automation.

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

Hosted attestation creation passed for `0.1.1`. Independent verification of its
downloaded assets remains **awaiting-manual**. The earlier `0.1.0` assets were not
attested by this workflow. Keep published assets and tags unchanged, and verify
the downloaded bytes rather than a local rebuild.

## Obsidian submission

The plugin is listed with **Review: Passed** in the
[community directory](https://community.obsidian.md/plugins/colors-for-folders-files-and-tabs).
Users can install it through Obsidian; see [installation](USER_GUIDE.md#installation).
The initial submission does not need to be repeated for maintenance releases.

Keep the manifest, release assets, documentation and listing accurate as the
plugin changes. Continue following the
[official submission guide](https://docs.obsidian.md/plugins/releasing/submit-plugin)
and developer policies. Directory review and release automation are separate;
passing review does not replace the project's regression and native checks.

## Plugin-guideline review

The MVP review checked source and README against the official
[plugin guidelines](https://github.com/obsidianmd/obsidian-developer-docs/blob/main/en/Plugins/Releasing/Plugin%20guidelines.md),
[submission requirements](https://docs.obsidian.md/community-directory/submission-requirements-for-plugins)
and [developer policies](https://docs.obsidian.md/community-directory/developer-policies).
Runtime is offline and metadata-only; no sample functionality, default hotkeys,
unsafe HTML or Node/Electron imports remain. Native settings, registered cleanup,
MIT attribution and preserved desktop/minimum-version metadata were inspected.

Preserve these design constraints and investigate unresolved behavior if it recurs:

| Area                    | Retained behavior and reason                                                                                                                                                                                                                                 |
| ----------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Path normalization      | `normalizeVaultPath` preserves case, whitespace and Unicode while rejecting absolute paths, control characters and parent traversal. It differs from the recommended host `normalizePath`; replacing it requires identity/settings compatibility review.     |
| Settings metadata guard | Adapter `stat` is limited to this plugin's `data.json`, using the host-provided plugin directory. It distinguishes missing data from swallowed read/parse failures while native `loadData`/`saveData` retain bookkeeping. No automatic repair save is added. |
| Host internals          | Guarded tab-header access remains in adapters; unavailable identities/views stay neutral. The scheduling window is acquired after layout readiness. Recheck these assumptions when host versions change.                                                     |
| Dynamic colors          | Namespaced CSS variables carry user/theme colors and measured contrast results; layout and other styling remain in plugin CSS.                                                                                                                               |
| Closed documents        | Earlier tracked cleanup passed, but ownership of two retained closed documents was unresolved. This is not proof of a plugin leak or complete collection.                                                                                                    |

The local review found no new blocking runtime defect in its scope. The subsequent
Obsidian review passed, as recorded above. Neither result expands the tested
platforms, themes or accessibility scope documented in [TESTING.md](TESTING.md).
