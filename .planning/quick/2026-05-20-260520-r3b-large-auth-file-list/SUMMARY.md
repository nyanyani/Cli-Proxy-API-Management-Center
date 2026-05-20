---
quick_id: 260520-r3b
slug: large-auth-file-list
phase: quick-260520-r3b-large-auth-file-list
plan: 01
type: quick
status: completed
completed: 2026-05-20T11:37:43Z
duration: 3m
commit: 4d8175e
key-files:
  modified:
    - src/services/api/authFiles.ts
validation:
  - pnpm exec prettier --write src/services/api/authFiles.ts
  - pnpm run type-check
  - pnpm run lint
  - pnpm run build
---

# Quick Task 260520-r3b: Large Auth File List Summary

Auth Files list metadata enrichment now uses one wildcard `/auth-files/download?name=*` request instead of per-file download fan-out, while only merging whitelisted plan/quota metadata into list rows.

## Changed Files

| File | Change |
| ---- | ------ |
| `src/services/api/authFiles.ts` | Added private bulk metadata parser/downloader and changed `enrichAuthFilesWithPlanMetadata()` to call wildcard download once for rows missing metadata. |

## Implementation Summary

- Added bulk metadata parsing for practical wildcard download shapes:
  - top-level arrays
  - `{ files: [...] }`
  - `{ items: [...] }`
  - records keyed by filename with object values or JSON-string values
  - nested object/JSON-string fields such as `json`, `content`, `data`, `value`, and `authFile`
- Preserved the existing `dedupeAuthFilesResponse()` semantics: rows are still deduped, sorted by name, and `total` remains `normalizedFiles.length` before enrichment.
- Changed `enrichAuthFilesWithPlanMetadata()` to:
  - skip rows that already have public plan metadata
  - skip rows with empty names or runtime-only rows
  - call `apiClient.getRaw('/auth-files/download?name=*', { responseType: 'blob' })` once when enrichment is needed
  - merge only values returned by `pickAuthFilePlanMetadata()`
- Removed the risky list-loading path that called `authFilesApi.downloadJsonObject(name)` per row.

## Validation Results

| Command | Result | Notes |
| ------- | ------ | ----- |
| `pnpm exec prettier --write src/services/api/authFiles.ts` | Passed | Formatted changed source file. |
| `pnpm run type-check` | Passed | `tsc --noEmit` completed successfully. |
| `pnpm run lint` | Passed | ESLint completed successfully. |
| `pnpm run build` | Passed | Vite build completed successfully; Windows shell printed two `system cannot find the path specified` messages during build startup, but the command exited successfully and produced the normal single-file build output. |

## Manual Verification Status

Not run: this repository is the React management UI only and no backend Management API with 6000+ auth files was available in this execution environment.

Manual check when backend data is available:

1. Start the backend Management API with 6000+ auth files.
2. Run `pnpm run dev`.
3. Open the Auth Files page.
4. Confirm DevTools Network shows at most one `/v0/management/auth-files/download?name=*` request for list metadata enrichment.
5. Confirm it does not issue one `/auth-files/download?name=<file>` request per row.
6. Confirm Advanced filter → Plan type still categorizes rows from auth-file JSON metadata when `/auth-files` list rows omit the plan fields.

## Deviations from Plan

None - plan executed as written.

## Security / Secret Boundary

- Raw wildcard auth-file objects are parsed only inside private helper scope.
- List rows receive only metadata fields whitelisted by `AUTH_FILE_PUBLIC_PLAN_METADATA_KEYS` through `pickAuthFilePlanMetadata()`.
- No logging was added.
- No real management keys or auth-file secrets were added to fixtures or docs.

## Known Stubs

None.

## Threat Flags

None. The plan already modeled the Management API → React UI auth-file JSON boundary and the mitigation was implemented by whitelisting metadata only.

## Commits

| Commit | Message |
| ------ | ------- |
| `4d8175e` | `fix(quick-260520-r3b): bulk load auth file metadata` |

## Remaining Issues

- Backend-backed verification still needs to be performed in an environment with 6000+ auth files.
- Unrelated working-tree modifications existed before this quick task and were left untouched.

## Self-Check: PASSED

- Found summary file at `.planning/quick/2026-05-20-260520-r3b-large-auth-file-list/SUMMARY.md`.
- Found source commit `4d8175e` in git history.
