# Desktop E2E — future work

Placeholder only. Playwright is not installed and no E2E command or CI job exists.
The current MVP uses unit tests and focused manual/native ColorsTest checks.

When desktop automation is explicitly scheduled, first establish a supported way
to control the installed desktop app in an isolated synthetic vault. Then cover:

- Assign/inherit/remove colors and persist settings across reload.
- Folder/file/tab identity, icons and actual row alignment.
- Keyboard palette/settings workflows, focus return, labels and visible errors.
- Theme/contrast changes and unload cleanup.

Restore test data and app state after each run. Keep E2E separate from unit-test
discovery; do not treat an ordinary web mock as full Obsidian integration coverage.
Automated accessibility checks complement actual screen-reader testing.
