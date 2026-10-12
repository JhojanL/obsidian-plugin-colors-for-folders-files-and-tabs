# Accessibility

The plugin preserves native names, keyboard interaction, focus and selection.
Named palette entries and file-type icons provide cues beyond color. Appearance
preferences can disable each coloring channel independently.

## Keyboard operation

- Open **Set folder color…** or **Manage palette** from Obsidian's command palette.
  Optional shortcuts can be assigned in **Settings → Hotkeys**.
- Use **Tab / Shift + Tab** to move between controls. Use **Space** to select a
  palette button or toggle a focused Appearance switch.
- Enter names/hex values in labeled fields, then activate **Apply**. **Escape** or
  **Cancel** closes the dialog without applying its draft.
- Selected palette buttons expose a pressed state. Invalid fields have associated
  guidance; pending saves and protected settings disable affected actions.

Focus returns to an available control after dialogs or list changes. Native color
picker interaction depends on the operating system. See the
[user guide](USER_GUIDE.md) for the complete workflows.

## Windows Narrator

With Narrator enabled, disable **Scan Mode** using **Caps Lock + Space**, then use
**Space** to toggle the focused switch. The maintainer confirmed Tab navigation
and Space activation in Obsidian **1.14.4**, both without Narrator and with this
workaround. Narrator's version and the manual-test bundle hash were not recorded.
Enter activation was not part of that final reported retest.

## Contrast and layout

The project requires at least **4.5:1 for text** and **3:1 for informative glyphs**
on measured, composited backgrounds. Colors adapt to appearance and descendants
use subtle variations. If a surface cannot be measured safely, or CSS feedback
invalidates its foreground, the affected document uses native foregrounds.
This fallback preserves host styling; it does not certify the theme's contrast.

Plugin-scoped layout rules center inserted Explorer glyphs while preserving
indentation, row height, disclosure controls and long-label behavior. **Color names**
is disabled by default. Focus, selected state and folder/file names remain native cues.

## Recorded Windows scope

| Evidence                                          | What it establishes                                                                                                                                          | Limits                                                                                       |
| ------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------- |
| Automated unit/DOM regressions                    | Names, selected/error states, checkbox/change handling, focus recovery, save guards, contrast logic and cleanup contracts                                    | jsdom cannot establish pixel alignment, native picker behavior or spoken output.             |
| Native ColorsTest presentation checks, 2026-10-10 | Obsidian 1.14.4, Default theme, light/dark; sampled normal/hover/selected contrast, alignment, long labels, 200% zoom, picker and pop-out decoration cleanup | These checks precede the final keyboard revision and remain tied to their recorded artifact. |
| Maintainer confirmation, 2026-10-10               | Screen-reader announcements, Windows contrast themes and complete keyboard-only Settings navigation; Narrator workaround above                               | Narrator version, contrast-theme names and exact manual-test artifact hash are unspecified.  |

Earlier Minimal/Things checks do not validate the current build. Linux/macOS,
other current-build themes and other assistive technologies remain untested.
Mobile support is deferred. These observations are scoped evidence, not a claim
of universal accessibility or standards certification. Build identifiers are in
[recorded evidence](TESTING.md#recorded-evidence-and-limitations); reusable checks are in
[TESTING.md](TESTING.md#native-presentation-and-accessibility).

## Report an accessibility issue

Use the repository's bug form. Describe the task, expected and observed behavior,
plugin/app versions, operating system, theme/snippets and assistive technology
name/version. Include keyboard steps and whether Narrator Scan Mode is enabled
when relevant. Screenshots or spoken-output descriptions are optional; use
synthetic content and remove private paths. Follow [SECURITY.md](../SECURITY.md)
if the issue may expose data or pose a security risk.
