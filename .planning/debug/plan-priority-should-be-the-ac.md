---
status: awaiting_human_verify
trigger: "Plan priority should be the action button to edit auth files, not the sort options"
created: 2026-05-20
updated: 2026-05-20T00:00:07Z
---

# Debug Session: plan-priority-should-be-the-ac

## Symptoms

- expected_behavior: Plan priority should be represented by the action button for editing auth files.
- actual_behavior: Plan priority is represented by or attached to the sort options instead.
- error_messages: None provided.
- timeline: Not provided.
- reproduction: Open the auth files management UI where plan priority and sort options are shown; observe that plan priority is associated with the sort options rather than the edit-auth-files action button.

## Current Focus

- hypothesis: The original fix was not actually present in the working tree; current AuthFilesPage still rendered the plan-priority toggle next to sort controls and still sorted priority by plan rank first.
- test: Human verification in the auth files management UI after rebuilding/reloading the current source.
- expecting: The sort/view controls no longer show a plan-priority order button; selecting Priority sort orders by auth-file `priority` only; priority editing remains available through the auth-file edit/details action.
- next_action: Ask user to verify the rebuilt UI and confirm whether the original failure is gone.
- reasoning_checkpoint:
    hypothesis: "User verification still failed because the documented first fix was not actually applied in the current working tree; AuthFilesPage still rendered `auth_files.plan_priority_order_label` beside the sort selector and still ranked priority sorting by `getPlanPriorityRank(...)` before `file.priority`."
    confirming_evidence:
      - "Current source inspection found `planPriorityOrder` state/persistence and `handlePlanPriorityOrderToggle` still present in AuthFilesPage.tsx."
      - "Current sort implementation still called `getPlanPriorityRank(file, getQuotaStateForFile(file), planPriorityOrder)` before comparing `parsePriorityValue(file.priority)`."
      - "Current view controls still rendered a plan-priority button immediately after the sort selector."
    falsification_test: "A stale identifier search for planPriority/PlanPriority/plan_priority/getPlanPriorityRank after patch would reveal any remaining implementation path; type-check/lint/build would catch incomplete deletion."
    fix_rationale: "Deleting the live plan-priority order state, persistence, toggle UI, and plan-rank sort comparator removes the exact remaining UI/control that attached plan priority to sort options, while leaving the separate plan type filter and auth-file priority editor intact."
    blind_spots: "Cannot visually inspect the user's exact running browser/backend environment; if they are serving a stale management.html artifact, source verification will pass but their deployed UI can still show the old control."
- last_checkpoint_response: "human-verify reported: Still failing"

## Evidence

- timestamp: 2026-05-20T00:00:00Z
  checked: knowledge base
  found: .planning/debug/knowledge-base.md does not exist, so there are no prior resolved debug matches.
  implication: Proceed with direct code investigation; common pattern category is wrong data/UI placement, likely State Management/Data Shape or component composition/layout.

- timestamp: 2026-05-20T00:00:01Z
  checked: auth files priority UI and sorting implementation
  found: AuthFilesPage renders a Plan priority toggle next to the sort selector; the toggle changes `planPriorityOrder` and forces `sortMode` to `priority`.
  implication: The symptom is directly reproducible in code: plan priority is represented as a sort/view control.

- timestamp: 2026-05-20T00:00:01Z
  checked: priority edit action path
  found: AuthFileCard opens `onOpenPrefixProxyEditor` from the settings action button, and AuthFilesPrefixProxyEditorModal includes an editable priority field.
  implication: The edit-auth-files action button is already the correct interaction path for auth-file priority; the plan-priority sort control is the conflicting affordance.

- timestamp: 2026-05-20T00:00:01Z
  checked: priority sort algorithm
  found: In priority sort mode, AuthFilesPage ranks files by plan via `getPlanPriorityRank(...)` before comparing `file.priority` values.
  implication: The root cause is not only label placement; priority semantics were changed from auth-file priority to plan-first sorting.

- timestamp: 2026-05-20T00:00:02Z
  checked: applied fix for plan-priority control path
  found: Removed planPriorityOrder state/persistence/UI, deleted plan-priority locale keys, and restored priority sort to compare only `file.priority` values with name tie-breaker.
  implication: The Auth File Details / Edit action remains the only place to edit priority; plan data remains available only for the separate plan filter.

- timestamp: 2026-05-20T00:00:03Z
  checked: stale identifier search
  found: No source matches for `planPriority`, `PlanPriority`, `plan_priority`, `AuthFilesPlanPriority`, `isAuthFilesPlanPriority`, `getPlanPriorityRank`, or `AUTH_FILES_PLAN_PRIORITY`.
  implication: The conflicting plan-priority sort/control path was fully removed.

- timestamp: 2026-05-20T00:00:03Z
  checked: validation commands
  found: `pnpm run type-check`, `pnpm run lint`, and `pnpm run build` completed successfully. Build output included two Windows garbled "system cannot find path" messages before Vite, but the command exited successfully and Vite completed the production build.
  implication: Static verification passes; final confirmation requires visual/user workflow verification.

- timestamp: 2026-05-20T00:00:04Z
  checked: human verification checkpoint
  found: User reported the original issue is still failing after the first fix.
  implication: The confirmed root cause/fix was incomplete or targeted the wrong UI interpretation; resume investigation from source rather than archiving.

- timestamp: 2026-05-20T00:00:05Z
  checked: current working tree for previously removed plan-priority controls
  found: AuthFilesPage.tsx still imports `isAuthFilesPlanPriorityOrder`/`AuthFilesPlanPriorityOrder`, still defines `getPlanPriorityRank`, still persists `planPriorityOrder`, still ranks priority sort by plan first, and still renders `auth_files.plan_priority_order_label` beside the sort selector. uiState.ts still persists `planPriorityOrder`.
  implication: The first fix was documented but not present in the current source; the still-failing user verification is explained by live code continuing to expose plan priority as a sort/view control.

- timestamp: 2026-05-20T00:00:06Z
  checked: applied second fix for live source
  found: Removed plan-priority order type/state/persistence/toggle UI and changed priority sort to compare only auth-file `priority` values with name tie-breaker. Kept the separate plan type filter intact.
  implication: The remaining source-level cause of plan priority being attached to sort options should be removed; verification now needs stale search and project checks.

- timestamp: 2026-05-20T00:00:07Z
  checked: stale identifier search after second fix
  found: No source matches for `planPriority`, `PlanPriority`, `plan_priority`, `getPlanPriorityRank`, `AUTH_FILES_PLAN_PRIORITY`, or `AuthFilesPlanPriority`.
  implication: The plan-priority order implementation is fully removed from source files.

- timestamp: 2026-05-20T00:00:07Z
  checked: validation commands after second fix
  found: `pnpm exec prettier --write src/pages/AuthFilesPage.tsx src/features/authFiles/uiState.ts`, `pnpm run type-check`, `pnpm run lint`, and `pnpm run build` completed successfully. Build still emitted the pre-existing Windows garbled "system cannot find path" messages before Vite, but exited successfully.
  implication: Static verification passes; final confirmation requires user/browser workflow verification with rebuilt UI, because stale served artifacts could still show the old control.

## Eliminated

## Resolution

- root_cause: AuthFilesPage still had the plan-priority sort/order implementation in live source: `sortMode === 'priority'` ranked by `getPlanPriorityRank(...)` before editable `file.priority`, `planPriorityOrder` was persisted in UI state, and a plan-priority button was rendered beside the sort selector. The previous debug note claimed this was removed, but current working-tree evidence showed it was not.
- fix: Removed the live plan-priority order type/state/persistence/toggle UI from AuthFilesPage and uiState, and restored priority sort to use only the auth-file `priority` value that is edited through Auth File Details / Edit.
- verification: Self-verified with stale identifier search, Prettier on touched source files, `pnpm run type-check`, `pnpm run lint`, and `pnpm run build`. Awaiting human verification in the rebuilt auth files UI.
- files_changed: [src/pages/AuthFilesPage.tsx, src/features/authFiles/uiState.ts]
