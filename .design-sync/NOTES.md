# design-sync notes

- 2026-07-09: Sync intentionally skipped. This repo's frontend is **Angular 17** (no React,
  no Storybook, no packaged component dist/) — Claude Design consumes compiled React
  components, so a faithful sync is not possible. User chose to skip rather than sync
  tokens-only or reimplement components in React.
- 2026-07-11: Decision revisited and **re-confirmed** — user chose to keep the skip.
  Repo re-checked: still Angular 17 only, no React, no Storybook, no stories files.
- If this decision is revisited: the shared component library lives at
  `frontend/src/app/shared/components/` (~20 standalone Angular components) and design
  tokens are CSS custom properties in `frontend/src/styles.scss` (`:root { --color-* }`).
