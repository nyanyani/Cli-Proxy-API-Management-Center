---
status: resolved
trigger: "Priority: xxx first to set priority to fixed max priority (maybe 1000) and remove other type priority property; add the priority input and set action button, support batch"
created: 2026-05-20
updated: 2026-05-21
---

# Debug Session: priority-batch-set-action

## Symptoms

- expected_behavior: "Auth Files should expose a priority input plus a set-priority action button, support selected/batch updates, set selected auth files to a fixed/max priority value such as 1000 when requested, and use one canonical priority field instead of competing type-specific priority properties."
- actual_behavior: "The current UI does not provide the requested batch priority input/action flow, or still relies on another type-specific priority property that should be removed."
- error_messages: "None reported."
- timeline: "Requested during the Auth Files Batch Priority work on 2026-05-20."
- reproduction: "Open Auth Files, select one or more auth files, and try to set their priority from the list/batch controls; the requested priority input and batch set action are not available or not wired to a canonical priority field."

## Current Focus

- hypothesis: "Bulk batch priority now reaches the backend but fails in the browser because the implementation fires one PATCH request per selected auth file concurrently, exhausting browser/network resources for large selections."
- test: "Human-verify a large selected-file batch priority Set/Clear workflow against the real Management API backend."
- expecting: "Network panel shows at most a small bounded group of /auth-files/fields PATCH requests in flight, no net::ERR_INSUFFICIENT_RESOURCES appears, and all selected files eventually update or report only genuine per-file backend failures."
- next_action: "Ask user to retry the same bulk batch priority operation that previously produced net::ERR_INSUFFICIENT_RESOURCES."
- reasoning_checkpoint:
    hypothesis: "Bulk batch priority fails with net::ERR_INSUFFICIENT_RESOURCES because batchSetPriority creates one concurrent PATCH /auth-files/fields request per selected file via Promise.allSettled, so large selections exceed browser/network request resources before the backend can complete all updates."
    confirming_evidence:
      - "Human verification says the set/clear behavior is fixed, but bulk batch action fails with net::ERR_INSUFFICIENT_RESOURCES, which is a browser-side resource exhaustion error."
      - "useAuthFilesData.batchSetPriority uses Promise.allSettled(normalizedUpdates.map(...authFilesApi.patchFields...)), so concurrency equals selected file count with no cap."
      - "authFilesApi.patchFields sends a separate PATCH /auth-files/fields request for each name; there is no batch endpoint for priority fields in the current API wrapper."
      - "AuthFilesPage already uses runLimited with PROBE_CONCURRENCY=4 for large probe/persist workflows, showing this codebase already avoids unbounded bulk network concurrency elsewhere."
    falsification_test: "If code inspection after the fix still shows batchSetPriority can start all selected PATCH requests before any settle, or if validation reveals a backend batch endpoint exists and should be used instead, this hypothesis/fix is incomplete."
    fix_rationale: "Bounded request scheduling keeps the same per-file API contract and optimistic UI semantics while capping simultaneous browser requests, directly removing the resource exhaustion mechanism. Applying the same cap to batchSetStatus prevents the adjacent selected-file bulk action from retaining the same failure mode."
    blind_spots: "Cannot reproduce against the user's real Management API from this repo; verification can prove static/build correctness and source-level removal of unbounded concurrency, but final large-selection browser verification remains human-only."
- reasoning_checkpoint:
    hypothesis: "Batch priority still fails the requested workflow because the implementation only sets selected files to a nonzero priority and cannot correctly remove priority from the other selected/type group; when priority 0 is used as the backend deletion signal, batchSetPriority incorrectly stores/display 0 instead of deleting the local priority field."
    confirming_evidence:
      - "Trigger explicitly includes 'remove other type priority property'."
      - "AuthFilesPrefixProxyEditor uses patch.priority = 0 as the canonical delete signal and deletes next.priority in its preview for patch.priority === 0."
      - "useAuthFilesData.batchSetPriority currently sets successful/optimistic files to { ...file, priority: requestedPriority }, so requestedPriority 0 remains a displayed/filterable priority instead of being removed."
      - "AuthFilesPage renders only Set priority, with no explicit batch clear/removal action."
    falsification_test: "If after patch a search/code inspection shows priority 0 can still leave priority: 0 in local AuthFileItem state, or there is no UI action to send priority 0 for selected files, the fix is incomplete."
    fix_rationale: "Mirror the existing single-file priority deletion contract in the batch path and expose a clear action next to Set priority, so the same selected/batch mechanism can set priority=1000 for desired files and remove priority from other selected files."
    blind_spots: "The exact user's 'still failing' observation did not include screenshots/network errors, so this targets the remaining source-level gap evidenced by the original trigger and current code; real Management API verification is still required."
- tdd_checkpoint: ""

## Evidence

- timestamp: 2026-05-20
  checked: "Knowledge base"
  found: "No resolved entry specifically matches batch set priority; nearest entry plan-priority-should-be-the-ac says prior root cause was plan-priority sort controls competing with editable auth-file priority."
  implication: "Treat competing priority sources as a candidate but verify current source; likely State Management / dual source of truth pattern."

- timestamp: 2026-05-20
  checked: "AuthFilesPage batch priority implementation"
  found: "Batch priority is controlled by BatchPriorityStrategy ('plus-team-first' | 'free-first'), BATCH_PRIORITY_RANKS by PlanCategory, and two buttons that assign descending priorities by sorted plan category."
  implication: "This directly contradicts the requested priority input + set action that assigns a fixed/max value such as 1000."

- timestamp: 2026-05-20
  checked: "useAuthFilesData.batchSetPriority and authFilesApi.patchFields"
  found: "batchSetPriority normalizes { name, priority } updates and calls authFilesApi.patchFields(name, { priority }); authFilesApi.patchFields sends PATCH /auth-files/fields with canonical priority."
  implication: "The backend wiring already supports canonical priority updates; the minimal fix is UI state/action construction, not a new API method."

- timestamp: 2026-05-20
  checked: "Implemented source changes"
  found: "Removed plan/type batch priority strategy code and stale strategy locale keys; added default 1000 batch priority input and Set priority action that maps selected files to canonical { name, priority } updates."
  implication: "The implementation now matches the requested fixed-value batch set action and avoids competing plan/type-specific priority assignment."

- timestamp: 2026-05-20
  checked: "Initial pnpm run type-check and pnpm run lint"
  found: "Type-check failed and lint warned because AuthFilesPage still imported the now-unused BatchPriorityUpdate type after removing strategy builder code."
  implication: "The fix needs cleanup of the stale type import before verification can pass."

- timestamp: 2026-05-20
  checked: "Verification commands"
  found: "pnpm exec prettier --write on touched source/style/locale files reported unchanged; pnpm run type-check passed; pnpm run lint passed; pnpm run build passed and produced Vite single-file output."
  implication: "Static verification and production build pass; real backend workflow still requires human verification because this repo cannot fully run without the Management API backend."

- timestamp: 2026-05-21
  checked: "Human verification checkpoint"
  found: "User reported 'still failing' after the first fix attempt."
  implication: "Previous root-cause explanation or fix is incomplete; reopen investigation and test the actual current code path end-to-end by inspection/static execution."

- timestamp: 2026-05-21
  checked: "Current AuthFilesPage batch priority UI"
  found: "Current source renders the numeric batch priority input and Set priority button only inside the floating selected-files action bar, and applyBatchPriority maps selected non-runtime files to { name, priority: batchPriorityValue }."
  implication: "The prior UI addition is present in source; the remaining failure is not simply that the input/button were never added."

- timestamp: 2026-05-21
  checked: "Current batchSetPriority implementation"
  found: "batchSetPriority sends one PATCH /auth-files/fields request per selected file via authFilesApi.patchFields(name, { priority }), applies optimistic local priority values, reports success/partial, then deselects all."
  implication: "If user sees no real update, likely causes are API contract/persistence mismatch, target selection mismatch, or requested behavior differs from selected-file batch flow."

- timestamp: 2026-05-21
  checked: "Stale priority strategy identifiers"
  found: "Search found no remaining planPriority/PlanPriority/plan_priority/getPlanPriorityRank strategy identifiers under src; only canonical priority field paths remain."
  implication: "The previous plan-priority sort/control path is not still present in the current source."

- timestamp: 2026-05-21
  checked: "Priority removal semantics"
  found: "The single-file prefix/proxy editor intentionally uses patch.priority = 0 as the deletion signal and its preview deletes next.priority for patch.priority === 0, but batchSetPriority currently maps a successful priority 0 update to { ...file, priority: 0 }."
  implication: "Batch priority does not mirror the existing canonical removal semantics; a user trying to remove other selected files' priority would still see priority 0 locally and priority filters would treat it as present."

- timestamp: 2026-05-21
  checked: "Applied second fix"
  found: "Added batch Clear priority action that sends priority 0 for selected non-runtime files; changed batchSetPriority optimistic/success/rollback state so priority 0 deletes local file.priority and failed clears restore whether the property originally existed."
  implication: "The batch flow now supports both setting selected files to a fixed/max priority and removing priority from selected other files using the same canonical priority field semantics as the single-file editor."

- timestamp: 2026-05-21
  checked: "Second-fix validation commands"
  found: "pnpm exec prettier --write on touched source/locale files completed; pnpm run type-check passed; pnpm run lint passed; pnpm run build passed and produced the Vite single-file output, with the pre-existing Windows garbled 'system cannot find path' messages before Vite."
  implication: "Static validation passes; only real backend/browser verification remains."

- timestamp: 2026-05-21
  checked: "Human verification checkpoint after second fix"
  found: "User reported the set/clear behavior is fixed, but bulk batch action fails with net::ERR_INSUFFICIENT_RESOURCES."
  implication: "Reopen investigation focused on bulk request scheduling/resource exhaustion, not the priority field semantics already confirmed fixed."

- timestamp: 2026-05-21
  checked: "Batch request scheduling in useAuthFilesData and authFilesApi"
  found: "batchSetPriority uses Promise.allSettled over normalizedUpdates.map(authFilesApi.patchFields), so it starts one PATCH /auth-files/fields request per selected file concurrently. batchSetStatus has the same unbounded Promise.allSettled pattern for PATCH /auth-files/status."
  implication: "The priority bulk failure mechanism is confirmed: large selections can exhaust browser/network resources. The adjacent selected-file status batch action should be capped too because it has the same request fan-out pattern."

- timestamp: 2026-05-21
  checked: "Applied third fix"
  found: "Added BATCH_MUTATION_CONCURRENCY=4 and runLimitedSettled in useAuthFilesData; batchSetPriority and batchSetStatus now process per-file PATCH calls with bounded concurrency instead of launching every request at once."
  implication: "The browser resource exhaustion mechanism has been removed for priority bulk updates and the adjacent status bulk update path."

- timestamp: 2026-05-21
  checked: "Third-fix validation commands"
  found: "pnpm exec prettier --write src/features/authFiles/hooks/useAuthFilesData.ts reported unchanged; pnpm run type-check passed; pnpm run lint passed; pnpm run build passed and produced the Vite single-file output, again with the pre-existing Windows garbled 'system cannot find path' messages before Vite. A grep of useAuthFilesData found no remaining Promise.allSettled calls and found batchSetPriority/batchSetStatus using runLimitedSettled with BATCH_MUTATION_CONCURRENCY."
  implication: "Static validation passes and source inspection confirms the unbounded concurrency mechanism is removed. Real large-selection backend verification is still required."

## Eliminated

## Resolution

- root_cause: "Two issues were found in sequence. First, the initial batch priority implementation had no clear-priority path and treated backend deletion signal priority=0 as a real local priority value. After that was fixed, large bulk batch priority still failed because batchSetPriority launched one concurrent PATCH /auth-files/fields request per selected file with Promise.allSettled, causing browser/network resource exhaustion (net::ERR_INSUFFICIENT_RESOURCES) for large selections."
- fix: "Kept the numeric Set priority action, added a batch Clear priority action that sends priority 0 for selected non-runtime auth files, changed batchSetPriority optimistic/success/rollback state so priority 0 deletes the local priority field while failures restore whether priority originally existed, and capped per-file batch mutation requests with runLimitedSettled/BATCH_MUTATION_CONCURRENCY=4 for both batchSetPriority and batchSetStatus. Added localized Clear priority labels."
- verification: "Self-verified third fix with pnpm exec prettier --write src/features/authFiles/hooks/useAuthFilesData.ts, pnpm run type-check, pnpm run lint, pnpm run build, and source grep confirming no Promise.allSettled remains in useAuthFilesData. User confirmed the real large-selection Management API backend workflow is fixed."
- files_changed:
  - src/features/authFiles/hooks/useAuthFilesData.ts
  - src/pages/AuthFilesPage.tsx
  - src/pages/AuthFilesPage.module.scss
  - src/i18n/locales/en.json
  - src/i18n/locales/zh-CN.json
  - src/i18n/locales/zh-TW.json
  - src/i18n/locales/ru.json
