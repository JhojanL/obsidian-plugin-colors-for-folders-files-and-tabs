# Contributing

Focused bug fixes, accessibility improvements, tests and documentation are welcome.
This is a desktop MVP; discuss new features, dependencies or architecture changes
in an issue before implementation. Suspected vulnerabilities belong in the
[private reporting channel](SECURITY.md).

## Workflow

1. Read [architecture](docs/ARCHITECTURE.md), [development setup](docs/DEVELOPMENT.md#setup)
   and [testing](docs/TESTING.md).
2. Keep the change focused and preserve unrelated local edits. Use clear names
   and comments for contracts that names/types do not explain.
3. Add a focused regression for a reproduced bug. Keep expectations independent
   of the implementation; test meaningful failures and side effects.
4. Run focused checks while editing and `mise exec -- pnpm run check` when ready.
   Documentation-only changes need formatting and link checks.
5. For runtime/UI changes, verify affected workflows in ColorsTest and record the
   artifact, app/theme, results and limitations. Mark unavailable required host
   checks **awaiting-manual**; see [native testing](docs/TESTING.md#when-native-checks-are-needed).

## Project contracts

- Keep runtime offline and metadata-only, with no note-content access, edits,
  telemetry, self-update or Node/Electron imports.
- Use `SettingsStore` for all persistence; preserve settings protection, stable
  plugin/command/palette IDs and stored-data compatibility.
- Preserve native names, focus/selection and keyboard behavior. Meet the project's
  **4.5:1 text / 3:1 glyph** contrast thresholds and provide cues beyond color.
- Scope styles and host internals to their existing modules; clean up owned resources.
- Preserve exact pins and the lockfile. Do not bypass hooks or weaken checks.
  Inspect the index after pre-commit fixes, especially when partially staging.
- Use UPPERCASE basenames with lowercase `.md` directly under `docs/`. Keep prose
  concise, images privacy-safe and alt text descriptive. Never commit builds,
  credentials, dependencies, vault data or recovery copies.

E2E directories are placeholders. Mobile, performance benchmarks and a new E2E
runner are outside the MVP scope.

## Pull requests and commits

Use the PR template to explain the problem, resulting change and verification.
Link a related issue when available; add screenshots when they help review a
visual change. State unavailable checks and material limitations.

Use Conventional Commit titles for squash merges: `fix: ...`, `feat: ...`,
`docs: ...`, `test: ...` or `chore: ...`. Mark an incompatible change with `!` and
explain it in the body. Release Please uses these titles for release PRs; review
the proposed version and changelog before merging. See
[release preparation](docs/RELEASE.md).

Maintainer review decides scope and acceptance. Merging a release PR triggers
automatic tagging and publication after checks pass. Repository creation, initial
release tagging and community-directory submission remain maintainer actions.

## License

Contributions use this project's [MIT license](LICENSE). You retain copyright;
no assignment or CLA is required. Preserve third-party notices and
[template provenance](NOTICE).
