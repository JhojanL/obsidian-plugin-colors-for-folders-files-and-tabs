# Mobile E2E — future work

Placeholder only. The MVP remains desktop-only (`isDesktopOnly: true`). No mobile
support, passing tests, Playwright dependency or runner is implied by this directory.

When mobile support is explicitly scheduled, evaluate the app integration and
real-device test approach first. Planned cases include touch targets, narrow and
rotated layouts, palette/settings interaction, focus/readout with mobile assistive
technology, inheritance and persistence.

Playwright viewport/device emulation can check responsive web UI where applicable;
it does not establish native iOS/Android Obsidian compatibility. Keep desktop-only
metadata until real host behavior is validated. Use disposable synthetic data.
