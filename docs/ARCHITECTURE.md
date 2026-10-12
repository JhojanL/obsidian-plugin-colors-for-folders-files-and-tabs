# Architecture

The plugin adds presentation and plugin settings without changing vault notes.
TypeScript is bundled by esbuild into one `main.js`; Obsidian supplies the host API.
There are no added runtime packages in the current production bundle.

| Module          | Responsibility                                                             |
| --------------- | -------------------------------------------------------------------------- |
| `src/main.ts`   | Load the settings store; register UI, adapters and cleanup                 |
| `src/model/`    | Validate palette/assignments, normalize paths and resolve inheritance      |
| `src/settings/` | Serialize settings reads/writes, handle recovery and notify subscribers    |
| `src/color/`    | Derive bounded color variations and adapt contrast on measured backgrounds |
| `src/adapters/` | Guard host identities, observe relevant DOM and own decoration lifecycle   |
| `src/ui/`       | Native settings, palette controls, dialogs and commands                    |

## Data and rendering

1. `SettingsStore` decodes plugin data into a validated immutable model. Changes
   are serialized through the plugin's settings APIs. Empty host reads are guarded
   by metadata for this plugin's `data.json`; note files are not accessed.
2. A folder uses its nearest explicitly assigned ancestor. Files start at their
   containing folder; file-backed tab icons follow that folder. No match is neutral.
3. Adapters resolve rendered rows and file-backed headers by identity, not title
   or position. Unsupported views stay neutral; deferred views are not forced open.
4. The controller batches requests with an animation frame. Adapters prepare their
   requested classes before shared surface measurements and foreground commits.
   A fresh verification phase checks contrast on final surfaces; unsafe feedback
   restores native foregrounds across that document's batch without a retry loop.
5. Registered cleanup cancels pending work, disconnects observers and removes
   owned decorations. Pop-outs use their own document/window realm.

## Design choices

- Pure model/color functions are easy to test without Obsidian. A small host stub
  supports DOM/unit regressions; it does not simulate the entire application.
- `SettingsStore` is the only persistence boundary. UI code must not bypass its
  queue, validation or failed-save recovery. A small host storage adapter rejects
  empty reads when `data.json` exists or its metadata is unavailable, preserving
  damaged settings while allowing first-install defaults.
- Internal host assumptions belong in guarded adapters. Avoid framework rewrites,
  global DOM scans, persistent computed-style caches and new runtime dependencies.
- Native names, controls, focus and selection remain meaningful without color.
  The engine targets text contrast of 4.6:1 and glyph contrast of 3.1:1 as a buffer
  above the project's acceptance thresholds. Final verification retains the
  unrounded 4.5:1 text and 3:1 glyph acceptance thresholds.
- Keep existing bounded identity/color caches and no idle polling. Numeric
  benchmark gates are not part of this MVP.
