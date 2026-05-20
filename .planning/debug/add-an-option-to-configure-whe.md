---
status: resolved
trigger: "add an option to configure whether selected filters change should clear selection"
created: 2026-05-20
updated: 2026-05-20T00:55:00Z
---

# Debug Session: add-an-option-to-configure-whe

## Symptoms

DATA_START
- Expected behavior: A configurable option should control whether changing selected filters clears existing selection.
- Actual behavior: Not specified by user; investigate current behavior and missing configuration support.
- Error messages: None provided.
- Timeline: Not provided.
- Reproduction: Not provided; derive from existing filter/selection flows in the UI.
- Diagnose only: false
DATA_END

## Current Focus

- hypothesis: Fix is verified in the user's real workflow/environment.
- test: Human toggled the new View options setting, selected auth files, changed filters/search, and observed whether selection clears only when enabled.
- expecting: Confirmed fixed by user.
- next_action: Archive debug session, commit code changes, and update debug knowledge base.
- reasoning_checkpoint:
    hypothesis: "AuthFilesPage lacked a configurable filter-change-to-selection-clear transition because every filter handler updated filter state and page independently while selection only exposed `deselectAll()` from `useAuthFilesData`."
    confirming_evidence:
      - "`useAuthFilesData` exposes `deselectAll()` and keeps selection independent of filters; it only prunes removed file names."
      - "AuthFilesPage filter/search handlers directly called `setFilter`/`setSearch`/`set*Filter` and `setPage(1)` with no shared option or persisted setting."
    falsification_test: "If there had been an existing persisted setting or central filter-change helper already called by all selected filter handlers, this hypothesis would be wrong. Code search found none."
    fix_rationale: "Added a persisted boolean option and a shared filter-change commit helper in AuthFilesPage; handlers use it so selection is cleared exactly when the option is enabled, without moving filter knowledge into the data hook."
    blind_spots: "No backend runtime available for browser verification; verification relies on type-check/build and targeted code inspection."
- tdd_checkpoint:

## Evidence

- timestamp: 2026-05-20T00:00:00Z
  checked: common bug patterns
  found: Symptom maps to State Management / configurable transition behavior; likely an invalid/over-specific transition where filter changes always clear selection.
  implication: Investigate filter-change-to-selection-clear state transition and whether it can be parameterized at the shared coordination point.
- timestamp: 2026-05-20T00:10:00Z
  checked: src/features/authFiles/hooks/useAuthFilesData.ts selection API
  found: Selection is owned by `useAuthFilesData`; it exposes `deselectAll()` and only prunes selected names when backing files disappear. It has no filter awareness.
  implication: Filter-change clearing should be coordinated by the page that owns filters, not inside the data hook.
- timestamp: 2026-05-20T00:10:00Z
  checked: src/pages/AuthFilesPage.tsx filter handlers
  found: Each filter/search handler independently calls a `set*Filter` or `setSearch` setter and `setPage(1)`. No shared option exists to clear selected files when those selected filters change.
  implication: Root cause is missing configurable state transition at filter-change call sites; a shared helper can clear selection when enabled while preserving existing default behavior if disabled by default.
- timestamp: 2026-05-20T00:50:00Z
  checked: implementation
  found: Added `clearSelectionOnFilterChange` to persisted Auth Files UI state, exposed it as a View options toggle, and routed filter/search handlers through `commitFilterChange(changed, applyChange)` which calls `deselectAll()` only when enabled and the value changed.
  implication: The requested configurable behavior is implemented at the page coordination layer without coupling filter state into `useAuthFilesData`.
- timestamp: 2026-05-20T00:50:00Z
  checked: pnpm run type-check
  found: `tsc --noEmit` completed successfully.
  implication: TypeScript accepts the new option, persistence field, and handler wiring.
- timestamp: 2026-05-20T00:50:00Z
  checked: pnpm run build
  found: `tsc && vite build` completed successfully and generated the single-file Vite artifact.
  implication: Production build path accepts the changes.

## Eliminated

## Resolution

- root_cause: AuthFilesPage had no configurable state transition for filter changes to clear selected auth files; filter/search handlers were independent direct setters and selection state was managed separately by useAuthFilesData.
- fix: Added persisted `clearSelectionOnFilterChange` Auth Files UI option, a shared `commitFilterChange` helper that clears selection only when enabled and the filter value changes, wired filter/search handlers through it, and added locale labels.
- verification: Self-verified with `pnpm run type-check` and `pnpm run build`; user confirmed fixed in the real workflow/environment.
- files_changed:
  - src/pages/AuthFilesPage.tsx
  - src/features/authFiles/uiState.ts
  - src/i18n/locales/en.json
  - src/i18n/locales/zh-CN.json
  - src/i18n/locales/zh-TW.json
  - src/i18n/locales/ru.json
