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

## Releases

See [RELEASE.md](RELEASE.md) for GitHub configuration, the initial release and
bootstrap, automatic versioning/publication, recovery and Obsidian submission.
