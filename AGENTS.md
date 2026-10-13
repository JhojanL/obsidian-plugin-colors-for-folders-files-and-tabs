# Obsidian plugin — MVP contributor instructions

Adapted from the [official sample instructions](https://github.com/obsidianmd/obsidian-sample-plugin/blob/master/AGENTS.md)
for this repository's tooling, settings protection and desktop MVP scope.

## Project overview

- TypeScript plugin for coordinated folder, file and tab-icon colors, using inherited folder assignments and a named palette.
- Entry point: `src/main.ts`, bundled by esbuild into `main.js`. Obsidian loads `main.js`, `manifest.json` and `styles.css` from the plugin folder.
- Desktop MVP, minimum Obsidian **1.14.4**; keep `isDesktopOnly: true`. The pinned official `obsidian` **1.13.1** declarations are build-time types, not the runtime minimum.

## Current scope and workflow

- Start with [docs/DEVELOPMENT.md](docs/DEVELOPMENT.md), [docs/TESTING.md](docs/TESTING.md) and the documentation relevant to the requested change.
- The maintainer accepted the desktop MVP on **2026-10-12**. Planning files and diagnostic captures are retired. Do not recreate performance harnesses, numerical performance gates or a report hierarchy.
- Preserve settings protection, icon/title alignment and contrast fixes. Windows verification, artifact boundaries, the Narrator Scan Mode workaround and remaining limitations are recorded in [docs/TESTING.md](docs/TESTING.md) and [docs/ACCESSIBILITY.md](docs/ACCESSIBILITY.md).
- The maintainer confirms latest-build images; light-mode captures are optional. Release Please prepares PRs, with automatic tagging/publication on merge. The initial `0.1.0` release is published; `Protect main` and private vulnerability reporting are enabled. Bootstrap is merged and Release Please created PR #4 with token-triggered CI. Final checks on its repair, hosted attestations and first generated-release publication remain pending; follow [release configuration](docs/RELEASE.md#github-configuration).
- The repository `JhojanL/obsidian-plugin-colors-for-folders-files-and-tabs` uses `main`. Continue changes through PRs requiring `build`; do not create/copy repositories or rewrite history without an explicit instruction. Merge `bootstrap-sha` from the published `0.1.0` tag's commit before enabling Release Please, as described in [RELEASE](docs/RELEASE.md#initial-release-and-bootstrap).
- Keep changes scoped to the request, run appropriate checks and record actual results in the PR or review notes. Never turn failures or unavailable checks into passes; use `awaiting-manual` for unavailable required host checks. Documentation-only edits do not require new host runs.
- Preserve unrelated local changes. Update AGENTS.md **last** when changing project scope or workflow.
- Desktop only for the MVP. `tests/e2e/desktop/` and `tests/e2e/mobile/` contain future Playwright documentation, not runnable tests or mobile support. Do not add a runner/dependency unless that work is explicitly requested.
- Do not create live tags/releases to test automation. Merging a release PR authorizes its automatic tagging/publication. Initial release tagging, repository transfer and community-directory submission require separate maintainer instructions.

## Build and tests

Use the pinned tools through mise: Node **24.21.0**, pnpm **12.8.1**, TypeScript
**6.0.3**. Keep `packageManager` aligned with `mise.toml`, preserve exact pins and
`pnpm-lock.yaml`, and keep the isolated `tooling/eslint/` workspace.

```bash
mise exec -- pnpm install --frozen-lockfile
mise exec -- pnpm run dev
mise exec -- pnpm run build
mise exec -- pnpm test
mise exec -- pnpm run check
```

`check` runs formatting, zero-warning lint, release metadata checks/tooling tests,
typed unit/DOM tests and production build. Vitest discovers only
`tests/unit/**/*.test.ts`, using jsdom and the small Obsidian stub in
`tests/fixtures/`. Release tests in `tests/tooling/` use Node's built-in runner.
Keep ordinary tests, hooks and CI independent of a running app. Runtime bundles
use esbuild; host/build tooling stays outside
`src/`. The only host runtime external is Obsidian. ESLint uses
`eslint-plugin-obsidianmd` through the isolated tooling workspace; run
`mise exec -- pnpm run lint` for a focused lint check.

Pre-commit formats/lints matching staged files sequentially and restages fixes;
inspect the index when partially staging. Pre-push and push/PR CI run the full gate.
Do not bypass hooks, weaken assertions or suppress findings to manufacture a pass.
Run focused tests while editing and the full gate once the change is ready.
Documentation-only changes need formatting and link checks, not new runtime tests.

## Architecture and coding

- Keep `src/main.ts` focused on lifecycle registration and cleanup. Use existing boundaries: `model/`, `settings/`, `color/`, `adapters/`, and `ui/`; see [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md).
- Route settings through `SettingsStore` and `createSettingsStorage` in `src/settings/storage.ts`. Keep native `Plugin.loadData()` / `saveData()` bookkeeping and serialized validation/recovery. Empty reads require metadata checks of this plugin's `data.json`: only confirmed absence permits writable defaults; existing or unreadable data stays protected. Do not use template `Object.assign` merging, automatic repair saves or direct UI persistence.
- Use Obsidian's `registerEvent`, `registerDomEvent`, `registerInterval` and registered disposers for owned resources. Cancel scheduled work and release observers, subscriptions and decorations on unload; preserve idempotent reloads.
- Keep host internals isolated and guarded in adapters. Resolve rows/tabs by file identity, never titles or positions. Preserve neutral/unsupported-view fallbacks and pop-out document ownership.
- Register commands with stable IDs through `this.addCommand(...)`; keep native settings and sensible defaults. Preserve the plugin ID, palette IDs and settings compatibility.
- Write strict TypeScript with clear names and small cohesive modules. Prefer existing utilities; no new runtime dependency or broad redesign without justification and maintainer agreement.
- Comment on non-obvious parameter meaning, invariants and ownership. Avoid comments that restate names/types or tests that mirror implementation.
- Retain meaningful model/storage/contrast/UI regressions and independent test oracles. Add focused regressions for reproduced bugs. Deterministic rendering work/cleanup checks remain useful; they are not timing benchmarks.
- Keep startup light, caches bounded and work scoped to rendered surfaces. Do not add idle polling, full-vault work during normal interaction or persistent computed-style caches. No numeric timing/size gate is required for this MVP.

## Accessibility and privacy

- Preserve native accessible names, semantics, keyboard behavior, visible focus/selection and error guidance. Use sentence case, clear action labels and named controls; do not rely on color alone.
- Measure actual backgrounds for text/glyph contrast. Keep project acceptance thresholds of **4.5:1 for text** and **3:1 for informative glyphs**, with native fallback for unsupported surfaces; do not lower them to pass a test.
- Fix icon/title alignment with plugin-scoped layout rules. Preserve indentation, disclosure hit areas, row height and long-label/zoom behavior. jsdom is not evidence of pixel alignment or spoken accessibility.
- Runtime is local/offline: no network, telemetry, note-content reads/edits, cloud features, self-updater, unsafe HTML, or Node/Electron imports. Vault path/type metadata and this plugin's settings are the runtime data boundaries.
- Development tools may access the configured synthetic vault for testing; that does not expand runtime permissions. Do not log or publish private vault data.

## Native host verification

Follow [docs/DEVELOPMENT.md](docs/DEVELOPMENT.md#test-in-windows-obsidian). Agents
may use the Windows Obsidian CLI through WSL for development checks; perform
available checks directly. Use **ColorsTest only**, never the user's other vaults.

- Deploy a successful build with `mise exec -- pnpm run dev:deploy`; it preserves `data.json`. Reload the plugin and fetch a fresh instance before testing. Manual installation copies only `main.js`, `manifest.json`, and `styles.css` into ColorsTest's plugin directory.
- Put `vault=ColorsTest` before every CLI command. Use `help` for syntax. The development guide gives a portable redirector-path example if `obsidian` is not on PATH.
- Send commands sequentially, safely quote Windows metacharacters and keep encoded/quoted eval arguments below **1,800 bytes**.
- Wait for layout readiness and make the window visible. Scroll virtualized rows into view. Use vault-relative screenshot paths with forward slashes and inspect captures before claiming visual success.
- Restart the app only after confirming that ColorsTest is the only open vault. Re-fetch the plugin in the fresh process for persistence checks.
- Back up exact settings/fixture bytes before destructive synthetic tests. Restore paths/content, settings, configuration, temporary styles/probes and window state afterwards. Never test malformed data in a production vault.
- Another vault or installation of third-party themes/plugins needs explicit authorization. Preserve already granted authorization within the session.
- Record the tested artifact hash, app/theme, actual results and relevant limitations in the PR or review notes, following TESTING. Reuse matching evidence, but never attach old passes to changed artifacts or infer host success from unit tests.

## Documentation, assets and contribution

- Keep README, [CONTRIBUTING.md](CONTRIBUTING.md) and the guides concise, professional and factual. Update existing documents instead of building another audit/evidence hierarchy.
- Keep workflows in [USER_GUIDE](docs/USER_GUIDE.md), support scope in [ACCESSIBILITY](docs/ACCESSIBILITY.md), reusable checks in [TESTING](docs/TESTING.md), development setup in [DEVELOPMENT](docs/DEVELOPMENT.md), and release configuration/publication/submission in [RELEASE](docs/RELEASE.md). Preserve artifact limits and unresolved findings when updating documentation.
- Markdown directly under `docs/` uses **UPPERCASE basenames and lowercase `.md` extensions**. Subfolders use descriptive lowercase names. Fix local references when moving files.
- Use `assets/images/` for approved README/plugin images with descriptive alt text and synthetic/public content. Keep personal paths and private vault content out of documentation and screenshots.
- Keep MIT licensing, contributor ownership and template provenance in `LICENSE` and `NOTICE`. Contributions use MIT; no copyright assignment/CLA is required.
- Never commit `node_modules/`, generated `main.js`, build output, credentials, vault data or local recovery copies. Keep `.env.local` private and preserve the deploy script's `.dev-build-*` ignore rule.

## Manifest and releases

- Preserve the manifest's ID, name, author, description, version, minimum app version and desktop-only declaration. Check the official manifest reference when changing metadata or adopting newer APIs.
- A release synchronizes package/manifest and Release Please versions plus `versions.json`, uses the exact `x.y.z` manifest version as its tag without a `v` prefix, and attaches `main.js`, `manifest.json` and `styles.css` individually.
- Release Please prepares PRs after configuration and bootstrap in [RELEASE](docs/RELEASE.md) are complete. Use Conventional Commits and a dedicated token so generated PR updates receive CI. Discovery, publication and label recovery must match the generated component-suffixed branch documented in RELEASE; tag naming does not control PR branch naming. Discover existing open release PRs on reruns even when Release Please returns no changes.
- Push/PR CI validates builds. Merging a release PR automatically runs full checks on the merged commit, attests all three release assets with the pinned `actions/attest` action, tags it, uploads assets, publishes and updates PR labels. Keep ID-token and attestation write permissions scoped to the release job. Initial version-tag pushes also trigger publication. Preserve retry recovery and tag/commit agreement; never overwrite published assets on reruns. Community-directory submission remains a separate maintainer action.

## Resources

Use official Obsidian documentation for host contracts; check the pinned local
`obsidian` declarations for the APIs available to this build.
Consult the TypeScript references for language or compiler-option questions,
checking compatibility with the pinned TypeScript version and existing tsconfig
files. These references do not authorize dependency upgrades or relaxed checks.

- [Developer documentation](https://docs.obsidian.md/Home) and [official API declarations](https://github.com/obsidianmd/obsidian-api).
- [Manifest reference](https://docs.obsidian.md/Reference/Manifest).
- [Plugin lifecycle and resource cleanup](https://docs.obsidian.md/plugins/guides/lifecycle-management).
- [Pop-out windows and document ownership](https://docs.obsidian.md/plugins/guides/pop-out-windows).
- [Developer policies](https://docs.obsidian.md/community-directory/developer-policies).
- [Plugin submission requirements](https://docs.obsidian.md/community-directory/submission-requirements-for-plugins).
- [Obsidian CLI](https://obsidian.md/help/cli).
- [Obsidian style guide](https://obsidian.md/help/style-guide).
- [TypeScript Handbook](https://www.typescriptlang.org/docs/handbook/) — language features, types and narrowing.
- [TSConfig reference](https://www.typescriptlang.org/tsconfig/) — compiler options and their interactions.
