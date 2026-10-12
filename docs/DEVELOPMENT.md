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

The destination repository is now
`JhojanL/obsidian-plugin-colors-for-folders-files-and-tabs`, with fresh history on
`main`. Repository creation and the initial commit are complete. Continue with
normal commits and PRs; do not recreate the repository or rewrite its history.

Bootstrap tells Release Please where the first published version ends. Two files
record different parts of that baseline:

- `.release-please-manifest.json` already records version `0.1.0`. This alone does
  not publish a release.
- The top-level `bootstrap-sha` in `release-please-config.json` will identify the
  commit published as `0.1.0`. Release Please excludes that commit and earlier
  history from its first generated changelog entry. Use the released commit,
  which may differ from the repository's initial commit.

Follow this sequence once:

1. Do not create `RELEASE_PLEASE_ENABLED` yet. If it already exists under
   **Settings → Secrets and variables → Actions → Variables**, set it to `false`
   or delete it. The **Prepare release PR** job runs only when its value is
   exactly `true`; a missing variable keeps that job disabled. Keep
   `RELEASE_PLEASE_TOKEN` under **Secrets**. The initial tag-triggered **Release**
   workflow runs independently of this variable.
   Complete the [repository setup](#destination-repository-setup) below. Use PRs
   with a passing `build` check for preparation changes, as required by the
   configured `main` ruleset.
2. Keep the reviewed **Unreleased** summary until the initial release is
   authorized. Then change its heading to `0.1.0` with the actual release date,
   remove the sentence saying no date/tag has been assigned, and review the
   README/security policy's unreleased wording. Merge the preparation PR after
   checks pass. Keep all version files at `0.1.0`.
3. After explicit initial-release authorization, tag the reviewed commit on
   `main` as `0.1.0` and push that tag. This starts the **Release** workflow,
   which runs full checks and publishes automatically. A tag push is the
   publication action; no release PR is needed for this first release.

   ```bash
   git fetch origin main
   # Replace REVIEWED_COMMIT_SHA with the full SHA of the approved commit on main.
   git tag 0.1.0 REVIEWED_COMMIT_SHA
   git push origin refs/tags/0.1.0
   ```

4. Wait for the **Release** workflow to succeed. Verify the published `0.1.0`
   release, its notes and its three assets: `main.js`, `manifest.json` and
   `styles.css`. Do not enable release PRs while this publication is incomplete.
5. Read the full released commit SHA:

   ```bash
   git fetch origin tag 0.1.0
   git rev-parse '0.1.0^{commit}'
   ```

   In a separate `chore: configure release bootstrap` PR, add
   `"bootstrap-sha": "FULL_SHA_FROM_THE_COMMAND"` at the top level of
   `release-please-config.json`, alongside `"release-type"`. Preserve its other
   keys and `.release-please-manifest.json`. Use the actual 40-character SHA,
   not the tag name, a short SHA or this placeholder. Merge after `build` passes.

6. Under **Settings → Secrets and variables → Actions → Variables**, create or
   update the repository variable `RELEASE_PLEASE_ENABLED` with value `true`.
   This is a separate setting from the `RELEASE_PLEASE_TOKEN` secret. Variables do
   not themselves trigger this workflow; either run **Actions → Prepare release
   PR → Run workflow** on `main`, or let the next push to `main` trigger it.
   With only bootstrap/docs changes since `0.1.0`, no release PR is expected.
   Later `fix:` or `feat:` commits normally produce one.
7. After the first generated release PR has been merged and published, remove
   `bootstrap-sha` in a normal maintenance PR. Release Please then uses its
   release history to find the baseline.

No old repository SHA, tag or release is required. Finish one release before
merging another release PR. See the official
[bootstrap documentation](https://github.com/googleapis/release-please/blob/main/docs/manifest-releaser.md#bootstrapping).

### Destination repository setup

- Keep the absolute private-report URL in `.github/ISSUE_TEMPLATE/config.yml`
  pointed at this repository's `/security/advisories/new`. Confirm repository and README links.
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
- Enable squash merging with **Pull request title** as the default commit message.
  The maintainer's `Protect main` ruleset requires a PR, resolved review threads
  and `build`, with zero required approving reviews and no bypass actors. Keep
  preparation and bootstrap updates on this same PR path.
- Allow the release workflow's `GITHUB_TOKEN` to write contents and pull requests;
  tag rules must permit it to create version tags. It uses that token to tag,
  upload, publish and update labels in one run, without relying on token-created
  tags to trigger another workflow.

The maintainer reports completing manual GitHub setup on 2026-10-12. After the
repository became public, GitHub's API confirmed `main` as the default branch,
the active `Protect main` ruleset requiring `build`, and enabled private
vulnerability reporting. The initial commit's
[CI run passed](https://github.com/JhojanL/obsidian-plugin-colors-for-folders-files-and-tabs/actions/runs/38285336181);
its **Prepare release PR** run was skipped, and no tags or releases existed.
Token permissions/expiry, the current release-enable variable, form previews and
notification delivery still need verification; public API checks cannot establish
them. Initial publication, `bootstrap-sha` and enabling release PRs remain the
steps above. Check the final preparation PR's CI separately from the initial run.

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
