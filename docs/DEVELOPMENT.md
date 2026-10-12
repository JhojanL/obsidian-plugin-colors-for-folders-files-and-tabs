# Development

## Setup

Use Node **24.21.0** and pnpm **12.8.1** from `mise.toml`, and TypeScript **6.0.3**
from `package.json`. Preserve exact pins, `pnpm-lock.yaml` and the isolated
`tooling/eslint/` workspace. The pinned Obsidian **1.13.1** declarations are build
types; the runtime minimum remains **1.14.4**.

```bash
mise trust
mise install
mise exec -- pnpm install --frozen-lockfile
mise exec -- pnpm exec lefthook install
mise exec -- pnpm run check
```

Use `mise exec -- pnpm run dev` to watch, or `mise exec -- pnpm run build` for a
production bundle. [TESTING.md](TESTING.md#automated-checks) lists focused checks
and coverage boundaries. Tests and CI do not launch Obsidian.

Pre-commit formats/lints staged files sequentially and restages fixes; inspect the
index when partially staging. Pre-push and push/PR CI run the full gate. Keep host
and release tooling outside `src/`.

## Test in Windows Obsidian

Develop in WSL and deploy only to the existing synthetic **ColorsTest** vault.

```bash
cp .env.local.example .env.local
# Set OBSIDIAN_TEST_VAULT to /mnt/c/ObsidianDev/ColorsTest.
mise exec -- pnpm run dev:deploy
```

Keep `.env.local` private. `OBSIDIAN_CONFIG_DIR` optionally selects a renamed
configuration directory. Deployment builds and stages only `main.js`,
`manifest.json` and `styles.css`, replacing JS last. It preserves `data.json` and
unrelated files; symlink destinations and concurrent deployments are rejected.
Reload the plugin after deployment and fetch a fresh instance before testing.

Enable the plugin in **Settings → Community plugins**. With the Windows CLI
available, put `vault=ColorsTest` before every command:

```bash
cmd.exe /C "obsidian vault=ColorsTest help"
cmd.exe /C "obsidian vault=ColorsTest plugin:reload id=colors-for-folders-files-and-tabs"
cmd.exe /C "obsidian vault=ColorsTest dev:errors"
cmd.exe /C "obsidian vault=ColorsTest dev:screenshot path=.obsidian/cfft-check.png"
```

If PATH does not resolve it, a per-user Windows installation typically uses the
following path. Replace `<UserName>` with your Windows account folder before
running the command; adjust the path if Obsidian was installed elsewhere.

```bash
cmd.exe /C '"C:\Users\<UserName>\AppData\Local\Programs\Obsidian\Obsidian.com" vault=ColorsTest help'
```

Use CLI help for syntax. Run commands sequentially and safely quote Windows
metacharacters; keep encoded/quoted eval arguments below **1,800 bytes**. Wait for
layout readiness, show the window and scroll virtualized rows into view. Screenshot
paths are vault-relative with forward slashes; inspect captures before claiming success.
Restart only after confirming ColorsTest is the only open vault. Another vault or
installing third-party themes/plugins requires explicit authorization.

Follow [safe testing](TESTING.md#safe-colorstest-procedure) for exact backups and
restoration of settings, fixtures, probes and window state. Record actual results
and limitations in the PR or review notes, following [TESTING.md](TESTING.md).

## Documentation and assets

Use [USER_GUIDE.md](USER_GUIDE.md) for workflows, [ACCESSIBILITY.md](ACCESSIBILITY.md)
for keyboard/support scope and [ARCHITECTURE.md](ARCHITECTURE.md) for design.
Presentation screenshots belong in [assets/images](../assets/images/README.md).
Keep Markdown concise and repair
relative links/anchors when moving files. Do not commit generated bundles,
credentials, dependencies, vault data or recovery copies.

## Release preparation

[Release Please](https://github.com/googleapis/release-please-action) prepares
changelog/version PRs on `main`. Release Please itself does not create releases;
the release workflow automatically tags and publishes after a release PR is merged.
Package and plugin versions are updated together; the PR workflow reuses
`version-bump.mjs` to add the minimum-app mapping and formats generated files.
`check:release` rejects metadata disagreement in ordinary CI and invalid release tags.
The workflow also finds an existing open release PR when Release Please returns no
changes, so reruns can finish interrupted metadata synchronization.

Use Conventional Commit titles for squash merges: `fix:` for fixes, `feat:` for
features, and `!` for incompatible changes. Documentation/tests/maintenance use
`docs:`, `test:` or `chore:`; these alone normally do not propose a release.
Review generated versions, dates, compatibility mappings and changelog text.

### Bootstrap fresh history

1. Merge the accepted cleanup into the current repository's `master` branch, then
   download that branch's source ZIP. Create the empty destination repository
   `obsidian-plugin-colors-for-folders-files-and-tabs` without generated starter files.
   Extract the source, including dotfiles such as `.github`, and retain LICENSE/NOTICE.
   Update destination URLs before making one initial commit on `main`, which matches
   the workflows. Keep generated files and private configuration excluded. Repository
   creation and the initial commit are maintainer actions; do not copy old Git history.
2. Keep `RELEASE_PLEASE_ENABLED` unset while preparing the initial **0.1.0** release.
   Retain the reviewed **Unreleased** summary until that release is authorized;
   then give it the actual version/date. Do not copy old commit or tag references.
3. After the initial release, add `bootstrap-sha` to `release-please-config.json`
   using the full SHA of its release commit **in the new repository**. The checked-in
   Release Please manifest starts at `0.1.0`; it is a version baseline, not evidence
   of a published release. Bootstrap excludes the initial MVP from later changelogs.
4. Complete destination setup below, then enable `RELEASE_PLEASE_ENABLED=true`.
   Remove `bootstrap-sha` after the first generated release PR has been merged.

This uses the new repository's history. No old SHA, tag or release is required.
The release workflow creates version tags for subsequent releases; finish one
release before merging another release PR.
See its [bootstrap documentation](https://github.com/googleapis/release-please/blob/main/docs/manifest-releaser.md#bootstrapping).

### Destination repository setup

- Update the absolute private-report URL in `.github/ISSUE_TEMPLATE/config.yml`
  to the destination's `/security/advisories/new`. Confirm repository and README links.
- In a public destination repository, enable **Settings → Advanced Security →
  Private vulnerability reporting**. Preview the custom form and issue chooser.
  Files alone do not enable reporting. Administrators should watch **Custom →
  Security alerts** and check notification delivery preferences. See
  [GitHub's setup instructions](https://docs.github.com/en/code-security/how-tos/report-and-fix-vulnerabilities/configure-vulnerability-reporting/configure-for-a-repository).
- Add a repository-scoped fine-grained PAT as `RELEASE_PLEASE_TOKEN`, with
  **Contents**, **Pull requests** and **Issues** read/write access. Keep it private
  and track expiry. The workflow requires this token and does not fall back to
  `GITHUB_TOKEN`, so generated PR updates can trigger CI. See
  [GitHub's workflow authentication guidance](https://docs.github.com/en/actions/how-tos/write-workflows/choose-when-workflows-run/trigger-a-workflow).
- Confirm `main` is the destination branch or update the workflow triggers, target
  branch, release branch name and PR lookup filters together.
  Set the repository variable `RELEASE_PLEASE_ENABLED=true` only after bootstrap.
  Enable Actions under repository/organization policy, require **build** on PRs,
  and verify the final generated PR commit receives the full check.
- Allow the release workflow's `GITHUB_TOKEN` to write contents and pull requests;
  tag rules must permit it to create version tags. It uses that token to tag,
  upload, publish and update labels in one run, without relying on token-created
  tags to trigger another workflow.

Private reporting, credentials, branch protection and hosted previews remain
pending until the destination exists. A local schema check cannot prove them.

### Automatic releases

1. Review the release PR's changelog, version and minimum-app mapping. Complete
   any required native checks for runtime changes and wait for final PR CI.
2. Merge the release PR when ready to publish. The release workflow checks out
   that exact merged commit, validates metadata and runs the full gate.
3. After checks pass, it creates the exact **x.y.z** tag, uploads `main.js`,
   `manifest.json` and `styles.css` to a draft, then publishes automatically.
4. After verifying the published release and its assets, it replaces
   `autorelease: pending` with `autorelease: tagged` on the associated release PR.

For the initial **0.1.0** release, prepare the changelog as described above and
push its exact version tag on the reviewed commit. That tag also triggers full
checks and automatic publication. No release PR is required for this bootstrap.

If a run fails, rerun it after resolving the error. Existing tags must still point
to the checked commit. An existing draft resumes its uploads; an already published
release is verified without replacing its assets, then label updates are retried.
An API failure stops the job rather than being treated as an absent release.

Actions are pinned to commit hashes and use the same mise version as CI.
Attestations are omitted; no repository-plan eligibility is assumed. Do not create
a live tag/release or publish anything merely to test the workflow.

## Pre-submission checklist

- [ ] Destination links, private reporting,
      notifications, token/bootstrap and required CI checks are verified.
- [ ] Recheck official plugin requirements and the exceptions below; disclose
      platform/theme limitations and resolve any new blocking finding.
- [ ] Package/manifest/tag versions and the `versions.json` mapping agree.
      The published release has all three required assets and accurate release notes.
- [ ] After separate submission authorization, submit the destination repository
      through Obsidian's community-plugin process.
      Review README, LICENSE, NOTICE and desktop/minimum-version metadata again.

See the [official release process](https://docs.obsidian.md/Plugins/Releasing/Submit%20your%20plugin).

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
