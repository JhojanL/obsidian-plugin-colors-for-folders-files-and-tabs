# Changelog

## Unreleased

Initial desktop MVP, prepared as version **0.1.0** for Obsidian **1.14.4 or later**.
No release date or tag has been assigned.

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

Subsequent release PRs use Release Please with Conventional Commits. Tagging and
publication remain maintainer actions; see [release preparation](docs/DEVELOPMENT.md#release-preparation).
