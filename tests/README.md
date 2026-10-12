# Tests

See [TESTING.md](../docs/TESTING.md) for commands, coverage boundaries and safe
native verification.

- `unit/`: typed plugin model, persistence, contrast, adapter and UI regressions.
- `fixtures/`: small Obsidian/DOM stubs, synthetic settings and deterministic helpers.
- `tooling/`: isolated release metadata checks using Node's built-in test runner.
- `e2e/desktop/` and `e2e/mobile/`: future Playwright documentation, with no runner
  or implemented tests. The MVP remains desktop-only.

Vitest discovers only `unit/**/*.test.ts` in jsdom. Preserve independent oracles,
awaited operations and fixture cleanup. `rendering.test.ts` checks deterministic
work and resource ownership; it is not a timing benchmark. Real layout and speech
require the [native checklist](../docs/TESTING.md#native-presentation-and-accessibility).
