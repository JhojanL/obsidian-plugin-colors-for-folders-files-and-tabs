# Changelog

## [0.1.1](https://github.com/JhojanL/obsidian-plugin-colors-for-folders-files-and-tabs/compare/0.1.0...0.1.1) (2026-10-13)

### Bug Fixes

- **review:** address Obsidian findings and attest releases ([#3](https://github.com/JhojanL/obsidian-plugin-colors-for-folders-files-and-tabs/issues/3)) ([2ce717a](https://github.com/JhojanL/obsidian-plugin-colors-for-folders-files-and-tabs/commit/2ce717a9185e6de2c258df7a9823bd3eb8e6c7aa))

## 0.1.0 (2026-10-12)

Initial desktop MVP for Obsidian **1.14.4 or later**.

- Named/custom palette, folder assignments and nearest-ancestor inheritance.
- File-type icons, descendant color variations and independent Explorer
  icon/name and tab-icon coloring; name coloring starts disabled.
- Native settings, folder-menu actions and commands for assignment/palette management.
- Validated local persistence, failed-save retry and read-only protection for
  damaged, unreadable or newer-format settings.
- Explorer glyph alignment and measured contrast with native foreground fallback.
- Keyboard controls, named palette actions, focus recovery and the documented
  Windows Narrator Scan Mode workaround.
- User, accessibility and contributor guides; private security/public contribution
  forms and release preparation.

Windows verification is scoped to the recorded workflows. Linux/macOS and other
current-build themes remain untested; mobile and automated E2E are deferred.
See [accessibility](docs/ACCESSIBILITY.md) and [testing](docs/TESTING.md) for limits.

Subsequent release PRs use Release Please with Conventional Commits. Merging a
release PR triggers automatic tagging and publication after checks pass. The initial
release needs a separately authorized version-tag push; see
[release preparation](docs/RELEASE.md).
