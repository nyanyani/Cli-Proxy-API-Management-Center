---
quick_id: 260520-r3b
slug: large-auth-file-list
phase: quick-260520-r3b-large-auth-file-list
plan: 01
type: quick
status: corrected
completed: 2026-05-20T11:37:43Z
corrected: 2026-05-20T11:50:00Z
duration: 3m
commit: bd57fc7
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

Auth Files list metadata enrichment now avoids the large-list per-file download fan-out without issuing a literal wildcard download request. The earlier implementation incorrectly treated `*` as a real `name` value; that was corrected.

## Changed Files

| File                            | Change                                                                                                                       |
| ------------------------------- | ---------------------------------------------------------------------------------------------------------------------------- |
| `src/services/api/authFiles.ts` | Caps inline per-file metadata enrichment to small lists only and returns the list unchanged for large missing-metadata sets. |

## Implementation Summary

- Preserved the existing `dedupeAuthFilesResponse()` semantics: rows are still deduped, sorted by name, and `total` remains `normalizedFiles.length` before enrichment.
- Changed `enrichAuthFilesWithPlanMetadata()` to:
  - skip rows that already have public plan metadata
  - skip rows with empty names or runtime-only rows
  - enrich small lists by downloading individual named files only up to `MAX_AUTH_FILES_INLINE_METADATA_DOWNLOADS`
  - skip enrichment for larger missing-metadata sets to prevent thousands of `/auth-files/download?name=<file>` requests
  - never issue `/auth-files/download?name=*`; `*` is a glob/list symbol, not a literal auth filename

## Validation Results

| Command                                                    | Result | Notes                                                                                                                                                                                                                     |
| ---------------------------------------------------------- | ------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `pnpm exec prettier --write src/services/api/authFiles.ts` | Passed | Formatted changed source file.                                                                                                                                                                                            |
| `pnpm run type-check`                                      | Passed | `tsc --noEmit` completed successfully.                                                                                                                                                                                    |
| `pnpm run lint`                                            | Passed | ESLint completed successfully.                                                                                                                                                                                            |
| `pnpm run build`                                           | Passed | Vite build completed successfully; Windows shell printed two `system cannot find the path specified` messages during build startup, but the command exited successfully and produced the normal single-file build output. |

## Manual Verification Status

Not run: this repository is the React management UI only and no backend Management API with 6000+ auth files was available in this execution environment.

Manual check when backend data is available:

1. Start the backend Management API with 6000+ auth files.
2. Run `pnpm run dev`.
3. Open the Auth Files page.
4. Confirm DevTools Network shows no `/v0/management/auth-files/download?name=*` request.
5. Confirm it does not issue one `/auth-files/download?name=<file>` request per row for a 6000+ list.
6. Confirm Advanced filter → Plan type still categorizes rows when `/auth-files` list rows already include plan metadata.

## Deviations from Plan

Corrective deviation: the original quick plan was wrong because it treated `*` as a literal download name. The corrected implementation removes that request and uses a large-list cutoff instead.

## Security / Secret Boundary

- Large lists no longer trigger mass auth-file downloads.
- No wildcard/glob symbol is sent as a literal download `name`.
- No logging was added.
- No real management keys or auth-file secrets were added to fixtures or docs.

## Known Stubs

None.

## Threat Flags

None. The plan already modeled the Management API → React UI auth-file JSON boundary and the mitigation was implemented by whitelisting metadata only.

## Commits

| Commit    | Message                                                  |
| --------- | -------------------------------------------------------- |
| `4d8175e` | `fix(quick-260520-r3b): bulk load auth file metadata`    |
| `bd57fc7` | `fix(auth-files): skip metadata fan-out for large lists` |

## Remaining Issues

- Backend-backed verification still needs to be performed in an environment with 6000+ auth files.
- Unrelated working-tree modifications existed before this quick task and were left untouched.

## Self-Check: PASSED

- Found summary file at `.planning/quick/2026-05-20-260520-r3b-large-auth-file-list/SUMMARY.md`.
- Found source commit `4d8175e` in git history.
