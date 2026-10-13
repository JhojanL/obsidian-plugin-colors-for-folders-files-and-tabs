# Testing

Ordinary checks run without Obsidian. Native checks use the dedicated synthetic
**ColorsTest** vault; unit success alone does not establish host compatibility.

## Automated checks

Complete [development setup](DEVELOPMENT.md#setup), then use the pinned mise tools:

| Command                                                               | Purpose                                                                              |
| --------------------------------------------------------------------- | ------------------------------------------------------------------------------------ |
| `mise exec -- pnpm test`                                              | Type-check and run plugin unit/DOM tests.                                            |
| `mise exec -- pnpm exec vitest run tests/unit/settings-store.test.ts` | Run focused persistence regressions.                                                 |
| `mise exec -- pnpm run lint`                                          | Run ESLint with zero warnings allowed.                                               |
| `mise exec -- pnpm run format:check`                                  | Check repository formatting.                                                         |
| `mise exec -- pnpm run check:release`                                 | Validate package, plugin and release-version metadata.                               |
| `mise exec -- pnpm run test:release`                                  | Test release metadata checks with isolated files.                                    |
| `mise exec -- pnpm run check`                                         | Run formatting, lint, release checks/tests, typed plugin tests and production build. |

Vitest discovers only `tests/unit/**/*.test.ts`, uses jsdom and resolves Obsidian
to the small stub in `tests/fixtures/`. Test types use `tsconfig.tests.json`.
Release-tool tests use Node's built-in runner and stay outside plugin discovery.
They check metadata and version synchronization, not hosted GitHub execution.
For release workflow changes, check Actions syntax and exercise unchanged-PR
recovery, partial uploads, label retries and conflicting tags with local stubs.
Do not publish a real release just to test automation; verify hosted behavior
during an authorized release.

Coverage includes model validation/inheritance, protected settings and retry,
contrast with independent oracles, host identity/fallbacks, native-control events,
focus, subscription ownership and deterministic rendering/cleanup. Preserve fresh
fixtures, awaited operations and checks of observable outcomes. Rendering checks
are work/cleanup contracts, not timing benchmarks.

jsdom cannot verify native geometry, screen-reader speech, operating-system
pickers, Windows contrast themes or real Obsidian lifecycle behavior. Desktop and
mobile E2E directories contain future-work documentation; no runner is installed.

## When native checks are needed

Use native verification after changes to runtime integration, persistence,
rendering, CSS or keyboard behavior. Check the affected workflows on the changed
artifact; record its SHA-256, date, app version, theme/appearance and actual result
in the PR or review notes.
Mark unavailable required checks **awaiting-manual**. Reuse historical evidence
only within its recorded scope. Documentation edits do not require redeployment.

### Safe ColorsTest procedure

1. Follow [Windows deployment](DEVELOPMENT.md#test-in-windows-obsidian). Deploy a
   successful build, reload the plugin and fetch a fresh instance before probing.
2. Back up exact settings/fixture/configuration bytes before destructive tests.
   Run CLI commands sequentially with `vault=ColorsTest` before every command.
3. Wait for layout readiness, show the window and scroll virtualized rows into
   view. Use vault-relative screenshot paths and inspect the captures.
4. Restart only after confirming ColorsTest is the only open vault. Fetch a fresh
   plugin instance in the new process for persistence checks.
5. Restore exact bytes, paths, settings, snippets, probes and window state. Remove
   temporary captures from the vault. Never use a personal vault for corruption tests.

### Settings protection and behavior

- Genuine first install allows edits without an automatic default save.
- Malformed JSON, existing empty/null data, unreadable paths and newer schemas
  preserve original bytes and disable writes. Check recovery guidance.
- Corruption/external changes before an edit are revalidated; valid restoration
  recovers editing. Simulated permission failures must be labeled as simulated.
- Save failures retain a visible unsaved edit and support Retry saving. Rejected
  validation must not claim a saved or retained edit. Test reload/restart persistence
  separately, restoring the original settings afterwards.
- Assignment, override, clearing, palette edits and folder renames/deletions retain
  identity. Duplicate-title, pinned/deferred tabs and unsupported views behave safely.

### Native presentation and accessibility

- Compare coloring enabled/disabled in light/dark, long labels, narrow widths and
  200% zoom. Inspect icon/title alignment, indentation, disclosure hit areas and row height.
- Complete assignment, palette and Settings workflows using the keyboard. Check
  visible focus/selection, cancel/Escape and focus restoration after deletion.
- Check real screen-reader announcements, names, pressed/checked states, errors and
  disabled/busy controls. Record assistive technology/version and Narrator Scan Mode.
- Open the native picker and verify name/hex/picker synchronization. Test native
  Windows contrast themes and record their names; browser emulation is separate evidence.
- Measure final computed colors on actual composited backgrounds in normal,
  hover, selected and focused states: **≥4.5:1 text**, **≥3:1 informative glyphs**.
  Check CSS that changes backgrounds when plugin classes or properties appear;
  inspect native fallback and document isolation without weakening thresholds.
- Unload/reload and close pop-outs. Check remaining decorations, listeners,
  observers and scheduled work. Decoration cleanup does not establish collection
  or the owner of a retained document.

## Documentation and workflow checks

For documentation edits, check formatting, local links/anchors, image captions and
commands against the implementation. Validate GitHub YAML types, supported form
keys and unique IDs/labels. Use actionlint for workflow syntax when available.
Hosted previews, credentials and permissions require destination-repository checks;
local validation does not establish hosted success. Do not tag or publish to test a workflow.

## Recorded evidence and limitations

Windows Obsidian 1.14.4/ColorsTest checks on 2026-10-10 verified settings protection
and sampled Default-theme presentation and contrast, followed by a keyboard revision
and maintainer accessibility confirmation. The desktop MVP was accepted on 2026-10-12.
See [ACCESSIBILITY.md](ACCESSIBILITY.md#recorded-windows-scope) for the manual scope.

The relevant production `main.js` SHA-256 identifiers are:

| Artifact                   | SHA-256                                                            | Verification boundary                                                                                                                         |
| -------------------------- | ------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------- |
| Settings protection        | `29334b3657d660974a7f1dd0c0731c31c0e26f5f22399970e96fc5d8d55db784` | Native Default/dark checks; malformed data, rejected edits, recovery and reload persistence.                                                  |
| Presentation fixes         | `68702ecbdb8ac66122d9441d279c383c1d93e4181166d47c19e418147b75cb5d` | Native Default/light and dark checks; sampled contrast, alignment, zoom, picker and decoration cleanup. Predates the final keyboard revision. |
| Final local keyboard build | `b3e703eef027bf3d00b25240d7f8a4cdc3ee450c45df120e19891d8d156e7247` | Automated checks only for this local rebuild; not deployed or independently host-tested.                                                      |

Presentation and final-build `styles.css` SHA-256:
`34f67067b71bdb15de9e3eef111ac7761a86c4c0048be27060bc0903b6c744ff`.

The final automated gate passed 281 plugin tests in 19 files and seven release
metadata tests. Fifteen local workflow scenarios used simulated GitHub responses;
hosted Actions, credentials and form previews were unverified at that review.
Subsequent publication and configuration checks are recorded in
[RELEASE.md](RELEASE.md#current-status). The maintainer's
final keyboard/accessibility confirmation has no recorded bundle hash and must not
be attached to the local rebuild as a new native pass. On 2026-10-12, the maintainer
confirmed that the screenshots represent that day's build and that it works normally;
no capture hash or theme name was supplied. Linux/macOS and other current-build
themes remain untested; mobile and automated E2E are deferred.

An earlier review observed two closed documents surviving controlled collection.
Their retaining owner was not established. Tracked plugin cleanup passed; preserve
this uncertainty and investigate a reproduced plugin defect if one emerges.

### Obsidian review follow-up

On 2026-10-12, the review fixes passed the full local gate: 282 plugin tests in
19 files, release-metadata tests, formatting, lint and production build.
Actionlint 1.7.12 passed all workflows. Eight local scenarios with simulated GitHub
responses passed: initial publication, partial draft uploads, published-asset
preservation, tag disagreement, API failure, failed and retried label updates,
and rediscovery of an unchanged release PR. These simulations do not verify
GitHub's hosted attestation service or repository permissions.

The deployed and reloaded ColorsTest artifacts had these SHA-256 values:

- `main.js`: `b649f13d9efb0a41124063603ac5339150c350a3fbde5f8acfbce891bd3af26e`
- `styles.css`: `d4fc7b3280f03ca14c2c4c3d454a24379256d722f7ae8939cb74e1bba303167c`

Native checks used Windows Obsidian 1.14.4, Default theme and dark appearance.
Folder search returned the expected full folder paths. All three Appearance
rows retained horizontal layout at normal width and with the settings container
temporarily narrowed to 400 CSS pixels; ordinary setting controls stacked and
toggle rows had no horizontal overflow. The narrow settings-window capture was
inspected. The selection live region retained `role="status"`, remained in the
DOM and used computed `clip: rect(0px, 0px, 0px, 0px)`. No native errors were
captured. Settings were unchanged; temporary styles, dialogs, probes and vault
captures were removed, and the original focused element was restored.

The maintainer subsequently confirmed on 2026-10-12 that keyboard navigation and
screen-reader operation continue working after the review fixes. This is a
maintainer retest; the screen-reader version, individual announcement details and
manual-test artifact hash were not separately recorded.

The plugin is now published in the
[community directory](https://community.obsidian.md/plugins/colors-for-folders-files-and-tabs)
with **Review: Passed**. The `0.1.1` hosted release passed its build, attestation,
publication and label-update steps; see [release status](RELEASE.md#current-status).
Independent verification of downloaded assets remains **awaiting-manual**.
These results do not extend the native-test scope recorded above. The folder
chooser still enumerates folder metadata when searching.
