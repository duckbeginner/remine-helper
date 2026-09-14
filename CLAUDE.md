# CLAUDE.md - Remine Helper Project Instructions

## Project Overview
RESCENE Remine Helper Extension, Data Hub & Ops Portal (`remine-helper`).

## Key Development Rules & Architectural Principles
Detailed architectural guidelines are documented in [`DEVELOPMENT_GUIDE.md`](./DEVELOPMENT_GUIDE.md).

### 1. 3-Way Merge & Concurrency in Ops Portal (`docs/ops-m7k2x9.html`)
- Always compare 3 states: `Base` (`baseOverridesSnapshot`), `Local` (`pendingOverrides`), `Remote` (`latestGist`).
- Conflict condition: `Remote !== Base && Local !== Remote`.
- When user cancels conflict (`!keepLocal`):
  1. Delete local key from `pendingOverrides`.
  2. Call `loadSchedules()` immediately to roll back UI to remote state.
  3. Reset save button UI and `return;` immediately.
- Update `baseOverridesSnapshot` on both `loadSchedules()` completion and `onSaveToGistClick()` success.

### 2. iOS / PWA Safe Area
- Declare `viewport-fit=cover` in viewport meta.
- Fixed top navigation: `padding-top: env(safe-area-inset-top, 0px)`.
- Floating bottom elements: `bottom: calc(... + env(safe-area-inset-bottom, 0px))`.

### 3. Data Hub & Overrides Integrity
- Central Data Hub synchronizes raw schedules from Blip / Mnet APIs every 15 minutes.
- Never edit `schedules.json` directly.
- All manual edits (links, titles, associations, deletes) MUST be stored in `schedule-overrides.json` (`sourceOverrides`, `customSchedules`, `deleted`).

### 4. TDD & Quality Checklist
Before committing, ALWAYS run and pass:
```bash
npm run check
npm run lint
npm test
npm run test:e2e
```
