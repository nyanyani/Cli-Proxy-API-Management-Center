---
status: resolved
trigger: "Has plan filter return the wrong free auth files, fix it"
created: 2026-05-20
updated: 2026-05-20
---

# Debug Session: has-plan-filter-return-the-wro

## Symptoms

- expected_behavior: Plan filter should return/display only the correct free auth files for the selected plan.
- actual_behavior: Plan filter returns/displays the wrong free auth files.
- error_messages: None provided.
- timeline: Not provided.
- reproduction: Use the plan filter on auth files/free auth files and observe incorrect returned files.

## Current Focus

- hypothesis: The plan filter returns wrong free files because it is implemented as a generic yes/no "has any plan metadata" filter, so it cannot specifically select free-plan credentials.
- test: Replace the ternary plan filter with a plan-category filter and verify free category uses the same free-plan classification as plan priority sorting.
- expecting: Free filter includes only normalized free plan types (`free`, `plan_free`, `free-tier`, `free_tier`) and excludes paid/unknown/no-plan files.
- next_action: Apply minimal AuthFilesPage/uiState/i18n changes to make planFilter a category enum and update the predicate.
- reasoning_checkpoint:
  hypothesis: "AuthFilesPage returns wrong free auth files because `planFilter` is typed/rendered as `TernaryFilter` and line 1081 only checks `hasPlanField(file, quotaState)`, which distinguishes plan-present vs plan-absent but never distinguishes free vs paid plan categories."
  confirming_evidence:
    - "AuthFilesPage renders the plan filter with shared `ternaryFilterOptions` (Any/Yes/No), so there is no Free option for the selected plan."
    - "The filter predicate is `matchesTernary(planFilter, hasPlanField(file, quotaState))`, while free-plan detection exists only in `getPlanPriorityRank` via `FREE_PLAN_TYPES` and is not used by filtering."
  falsification_test: "If the existing predicate already compared the normalized plan type against `FREE_PLAN_TYPES`, the hypothesis would be wrong; direct code inspection shows it only checks boolean plan presence."
  fix_rationale: "Introduce a plan-category filter that classifies the resolved normalized plan as free/plus-team/other/none and applies that category in the filter predicate, addressing the selection semantics rather than changing unrelated data fetching."
  blind_spots: "Backend-specific plan strings beyond the known sets may still classify as Other until added; no backend is available in this repo for live UI reproduction."
- tdd_checkpoint:

## Evidence

- timestamp: 2026-05-20
  checked: common bug patterns for symptom "wrong data displayed"
  found: Quick map points first to Data Shape and State Management categories.
  implication: Initial hypotheses should focus on mismatched API contract/query params, wrong selector/predicate, or stale filter state.
- timestamp: 2026-05-20
  checked: src/pages/AuthFilesPage.tsx plan filter implementation
  found: Plan filter state is `TernaryFilter`, UI reuses Any/Yes/No options, and filtering calls `matchesTernary(planFilter, hasPlanField(file, quotaState))`.
  implication: The filter can only select credentials with/without any resolved plan, not a specific free plan category.
- timestamp: 2026-05-20
  checked: free-plan classification in src/pages/AuthFilesPage.tsx
  found: `FREE_PLAN_TYPES` exists but is only used by `getPlanPriorityRank` for sorting; it is not used by the plan filter predicate.
  implication: Free-plan selection semantics are missing from filtering, explaining wrong results when trying to filter free auth files.
- timestamp: 2026-05-20
  checked: implemented filter fix
  found: Changed `planFilter` from ternary yes/no to a persisted plan-category enum (`all`, `free`, `plus-team`, `other`, `none`) and wired AuthFilesPage to use free/paid category classification in the predicate.
  implication: Verification should confirm TypeScript accepts the new state shape and locale keys are present in all locale files.
- timestamp: 2026-05-20
  checked: pnpm run type-check && pnpm run lint && pnpm run build
  found: All commands completed successfully. Vite build printed two non-fatal Windows "system cannot find the path specified" messages before completing successfully.
  implication: The code compiles, lint passes, and the production bundle can be generated; final validation needs user confirmation against real backend auth-file data.

## Eliminated

## Resolution

- root_cause: AuthFilesPage implemented `planFilter` as a ternary "has any plan" boolean filter instead of filtering by normalized plan category; the free-plan classifier existed for sorting but was not used by filtering.
- fix: Replaced the plan filter with a plan-category selector and predicate; added UI state validation and locale strings for Free, Plus/Team, Other, and No detected plan.
- verification: Self-verified with `pnpm run type-check`, `pnpm run lint`, and `pnpm run build`; human verified fixed in backend-connected workflow on 2026-05-20.
- files_changed: [src/pages/AuthFilesPage.tsx, src/features/authFiles/uiState.ts, src/i18n/locales/en.json, src/i18n/locales/zh-CN.json, src/i18n/locales/zh-TW.json, src/i18n/locales/ru.json]
