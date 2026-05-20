---
status: resolved
trigger: user_report
slug: auth-file-plan-filter
created: 2026-05-20
---

# Debug Session: auth-file-plan-filter

## Symptoms

- Auth file JSON shown/exported/edited by the UI should not include nested `probe_quota`.
- Advanced filter → Plan type treats a Codex auth record with top-level `plan_type: "free"` as `No detected plan`.
- Redacted record shape includes top-level `type: "codex"`, `plan_type: "free"`, and nested quota metadata with `probe_quota.plan_type: "free"` / `probe_quota.data.planType: "free"`.
- Sensitive token fields were present in the original report and must not be logged or fixture-persisted.

## Current Focus

reasoning_checkpoint:
  hypothesis: "`authFilesApi.list()` returns list-summary rows that may omit auth-file JSON fields such as top-level `plan_type`, while Advanced filter only evaluates those list-summary rows; therefore a downloaded/editor auth record can contain `plan_type: \"free\"` but the filter still sees no plan."
  confirming_evidence:
    - "The human-provided auth JSON has top-level `plan_type: \"free\"`, yet manual verification still shows that record under `No detected plan`."
    - "Static trace shows `AuthFilesPage` filters only `files` from `useAuthFilesData.loadFiles`, and `loadFiles` gets those rows solely from `authFilesApi.list()` / `/auth-files`, not from `/auth-files/download`."
    - "The visible plan resolver would classify a row that actually contains `plan_type: \"free\"` as `free`, so the failing workflow implies that field is absent from the list row used by filtering."
  falsification_test: "If `/auth-files` list rows are confirmed to include `plan_type: \"free\"` for the failing row at filter time, or if enriched list rows containing `plan_type: \"free\"` still classify as `none`, this hypothesis is wrong."
  fix_rationale: "Enriching list-summary rows with a strict whitelist of non-secret plan/quota metadata from the raw auth JSON gives the filter the persisted plan fields it already knows how to classify, without putting tokens into React state or user-facing JSON surfaces."
  blind_spots: "No backend Management API is available in this repo, so `/auth-files` list payload shape cannot be observed directly here; final confirmation still requires the user's backend-backed workflow."
- next_action: "Ask user to re-run the backend-backed Advanced filter → Plan type workflow and confirm whether the Codex `plan_type: free` record no longer appears under `No detected plan`."
- verification: "`pnpm run type-check`, `pnpm run lint`, and `pnpm run build` passed after adding list-row plan metadata enrichment. User confirmed the backend-backed Advanced filter workflow is fixed. Build still emits the pre-existing two Windows mojibake 'system cannot find path' lines before Vite succeeds."

## Evidence

- timestamp: 2026-05-20T00:00:00Z
  source: user_report
  detail: A Codex auth entry with top-level `plan_type: "free"` is displayed/filtered as `No detected plan`; nested `probe_quota` should be removed from UI JSON surfaces.
- timestamp: 2026-05-20T00:00:01Z
  checked: src/pages/AuthFilesPage.tsx plan filter implementation
  found: `resolvePlanTypeForFile` already includes `file.plan_type`, `file['plan_type']`, metadata/attributes snake_case fields, and persistent `probe_quota` candidates before `matchesPlanFilter` categorizes free/plus-team/other/none.
  implication: The current checkout does not match the plan-filter half of the saved hypothesis; if the reported filter bug still reproduces, the failure is likely in the data passed into `files` or in a different display path, not the visible `matchesPlanFilter` logic.
- timestamp: 2026-05-20T00:00:02Z
  checked: src/features/authFiles/hooks/useAuthFilesData.ts and useAuthFilesPrefixProxyEditor.ts JSON surfaces
  found: Single and batch download stream raw backend blobs, and the prefix/proxy editor displays `JSON.stringify(file, null, 2)` plus downloaded JSON copied verbatim. No shared sanitizer removes `probe_quota` before UI display/export/edit preview.
  implication: The `probe_quota` leak is confirmed on JSON display/download paths; a shared sanitizer at API/download/editor boundaries is the likely minimal fix.
- timestamp: 2026-05-20T00:00:03Z
  checked: Applied code changes
  found: Added `omitAuthFileInternalMetadata`, `downloadPublicText`, and `downloadPublicJsonObject`; routed single/batch download and prefix/proxy editor file/download JSON through the sanitizer.
  implication: User-facing JSON surfaces should omit `probe_quota` without deleting top-level plan fields or changing the probe metadata persistence write path.
- timestamp: 2026-05-20T00:00:04Z
  checked: Verification commands
  found: `pnpm run type-check`, `pnpm run lint`, and `pnpm run build` passed. Build emitted two Windows mojibake "system cannot find path" lines before Vite succeeded, but exited successfully and produced `dist/index.html`.
  implication: The code is type-safe, lint-clean, and production-buildable; end-to-end confirmation needs a running backend and the user's real auth-file workflow.
- timestamp: 2026-05-20T12:00:00Z
  checked: Human verification response
  found: User reports the original plan-filter bug still reproduces: a Codex auth record with top-level `plan_type: "free"` still appears under Advanced filter → Plan type → No detected plan.
  implication: The previous conclusion that the current plan-filter path already handled this real workflow was falsified; investigation must resume on the actual filter/data normalization path, not the JSON sanitizer defect.
- timestamp: 2026-05-20T12:05:00Z
  checked: Knowledge base and current code path
  found: Knowledge base contains prior matching pattern for `No detected plan`/`plan_type free`. Current `AuthFilesPage` would classify an `AuthFileItem` containing top-level `plan_type: "free"` as `free`, but `useAuthFilesData.loadFiles` only uses `authFilesApi.list()` rows from `/auth-files`; raw auth JSON is only downloaded for editor/download/probe persistence paths.
  implication: The real contradiction is explained if the user-provided JSON shape is the downloaded auth file while the list row used by filtering lacks the raw `plan_type`/`probe_quota` fields. The fix should bridge list summaries to persisted non-secret plan metadata, not change `matchesPlanFilter`.
- timestamp: 2026-05-20T12:10:00Z
  checked: Applied code changes
  found: `authFilesApi.list()` now dedupes `/auth-files` rows and enriches rows that lack plan metadata by downloading the auth JSON and copying only whitelisted non-secret plan/quota metadata keys (`plan*`, `tier*`, `credit*`, `probe_quota`) into the list item.
  implication: Advanced Plan type filtering should now see persisted `plan_type: "free"` from raw auth files even when the list summary omits it, while access/id/refresh tokens are not copied into list state.
- timestamp: 2026-05-20T12:12:00Z
  checked: TypeScript verification
  found: `pnpm run type-check` passed after adding list-row plan metadata enrichment.
  implication: The enrichment code is type-safe under the repository's strict TypeScript settings.
- timestamp: 2026-05-20T12:15:00Z
  checked: Formatting/lint/build verification
  found: `pnpm exec prettier --write src/services/api/authFiles.ts`, `pnpm run lint`, and `pnpm run build` passed. Build emitted the same two Windows mojibake "system cannot find path" lines before Vite succeeded and generated `dist/index.html`.
  implication: The source is formatted, lint-clean, and production-buildable; only the backend-backed manual workflow remains unverified.
- timestamp: 2026-05-20T12:30:00Z
  checked: Human verification response
  found: User reports the original backend-backed workflow is confirmed fixed.
  implication: The fix is verified end-to-end and the debug session can be archived.

## Eliminated

- hypothesis: "The current plan-filter implementation already reads top-level snake_case `plan_type` for the real failing Codex row, so only the JSON `probe_quota` leak remains."
  evidence: "Human verification after the patch still shows the Codex row under Advanced filter → Plan type → No detected plan despite top-level `plan_type: \"free\"` in the reported record shape."
  timestamp: 2026-05-20T12:00:00Z

## Resolution

- root_cause: Two separate auth-file JSON boundary issues were present. First, user-facing auth-file JSON paths reused raw backend auth-file records, so UI-internal `probe_quota` metadata leaked into download/export and editor JSON display. Second, Advanced Plan type filtering operates on `/auth-files` list-summary rows; those rows can omit persisted raw auth JSON fields such as top-level `plan_type`, so a downloaded Codex auth record with `plan_type: "free"` could still be categorized as `No detected plan` because the filter never received that field.
- fix: Added a shallow auth-file public JSON sanitizer that omits `probe_quota`; used it for single/batch downloads and prefix/proxy editor JSON display/preview while keeping probe metadata persistence writes unchanged. Added list-row enrichment that copies only whitelisted non-secret plan/quota metadata from raw auth JSON into `/auth-files` list items when the list summary lacks plan metadata.
- verification: Static/self verification passed with `pnpm run type-check`, `pnpm exec prettier --write src/services/api/authFiles.ts`, `pnpm run lint`, and `pnpm run build`. User confirmed the backend-backed Advanced filter workflow is fixed.
- files_changed:
  - src/services/api/authFiles.ts
  - src/features/authFiles/hooks/useAuthFilesData.ts
  - src/features/authFiles/hooks/useAuthFilesPrefixProxyEditor.ts
