---
status: investigating
trigger: "Priority: xxx first to set priority to fixed max priority (maybe 1000) and remove other type priority property; add the priority input and set action button, support batch"
created: 2026-05-20
updated: 2026-05-20
---

# Debug Session: priority-batch-set-action

## Symptoms

- expected_behavior: "Auth Files should expose a priority input plus a set-priority action button, support selected/batch updates, set selected auth files to a fixed/max priority value such as 1000 when requested, and use one canonical priority field instead of competing type-specific priority properties."
- actual_behavior: "The current UI does not provide the requested batch priority input/action flow, or still relies on another type-specific priority property that should be removed."
- error_messages: "None reported."
- timeline: "Requested during the Auth Files Batch Priority work on 2026-05-20."
- reproduction: "Open Auth Files, select one or more auth files, and try to set their priority from the list/batch controls; the requested priority input and batch set action are not available or not wired to a canonical priority field."

## Current Focus

- hypothesis: "AuthFilesPage implements batch priority as plan-category ranking buttons instead of the requested explicit priority input plus set action, so selected files cannot all be assigned the same fixed/max canonical priority value."
- test: "Replace the strategy buttons with a numeric batch priority input defaulting to 1000 and one set button that calls existing batchSetPriority with the same canonical priority for each selected file."
- expecting: "After the change, there will be no BatchPriorityStrategy/BATCH_PRIORITY_RANKS/getBatchPriorityRank/type-specific batch priority path; batchSetPriority continues to patch only the canonical priority field."
- next_action: "Patch AuthFilesPage and locale strings to remove plan-based batch priority controls and add fixed-value batch priority input/action."
- reasoning_checkpoint:
    hypothesis: "Plan-category batch priority controls cause the reported failure because they compute different priority values from file type/plan metadata rather than accepting a user-entered canonical priority value."
    confirming_evidence:
      - "AuthFilesPage defines BatchPriorityStrategy plus-team-first/free-first and BATCH_PRIORITY_RANKS over PlanCategory."
      - "The floating batch bar renders only two strategy buttons, batch_priority_plus_team_first and batch_priority_free_first, with no input."
      - "useAuthFilesData.batchSetPriority already patches authFilesApi.patchFields(name, { priority }), so the missing piece is UI/action construction, not a backend endpoint."
    falsification_test: "If source still contains plan-based batch priority strategy code or the UI lacks a numeric input/set button after patching, the fix is incomplete."
    fix_rationale: "Use the existing canonical batchSetPriority path but build updates from selected files and one numeric input value, defaulting to 1000; remove plan/type strategy code and stale translations."
    blind_spots: "Cannot verify against a real Management API backend in this repo; will verify with TypeScript/lint/build and code inspection."
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

## Eliminated

## Resolution

- root_cause: "AuthFilesPage's batch priority UI was implemented as type/plan-specific ranking actions (Plus/Team first or Free first) instead of the requested user-entered canonical priority setter, so selected files could not be batch-set to a fixed/max priority value such as 1000."
- fix: ""
- verification: ""
- files_changed:
