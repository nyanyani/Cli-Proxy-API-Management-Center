---
status: investigating
trigger: "add an option to configure whether selected filters change should clear selection"
created: 2026-05-20
updated: 2026-05-20T00:20:00Z
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

- reasoning_checkpoint:
    hypothesis: "AuthFilesPage lacks a configurable filter-change-to-selection-clear transition because every filter handler updates its filter state and page independently while selection only exposes `deselectAll()` from `useAuthFilesData`."
    confirming_evidence:
      - "`useAuthFilesData` exposes `deselectAll()` and keeps selection independent of filters; it only prunes removed file names."
      - "AuthFilesPage filter/search handlers directly call `setFilter`/`setSearch`/`set*Filter` and `setPage(1)` with no shared option or persisted setting."
    falsification_test: "If there is an existing persisted setting or central filter-change helper already called by all selected filter handlers, this hypothesis is wrong. Code search found none."
    fix_rationale: "Add a persisted boolean option and a shared filter-change commit helper in AuthFilesPage; handlers use it so selection is cleared exactly when the option is enabled, without moving filter knowledge into the data hook."
    blind_spots: "No backend runtime available for browser verification; verification will rely on type-check/build and targeted code inspection."
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

## Eliminated

## Resolution

- root_cause:
- fix:
- verification:
- files_changed:
