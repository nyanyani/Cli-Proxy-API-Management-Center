---
quick_id: 260520-r3b
slug: large-auth-file-list
created: 2026-05-20
phase: quick-260520-r3b-large-auth-file-list
plan: 01
type: quick
wave: 1
depends_on: []
repo: D:\repo\Cli-Proxy-API-Management-Center
status: corrected
autonomous: true
files_modified:
  - src/services/api/authFiles.ts
requirements:
  - QUICK-260520-R3B
validation:
  - pnpm exec prettier --write src/services/api/authFiles.ts
  - pnpm run type-check
  - pnpm run lint
  - pnpm run build
must_haves:
  truths:
    - Loading Auth Files with 6000+ entries does not issue one `/auth-files/download?name=<file>` request per file.
    - Loading Auth Files never sends `*` as a literal `download?name` value; `*` is a glob/list symbol, not a filename.
    - Advanced Plan type filtering still receives whitelisted plan/quota fields when `/auth-files` list rows already include them or when small-list inline enrichment is safe.
    - Sensitive auth-file secrets are not copied into React list state and are never logged.
  artifacts:
    - path: src/services/api/authFiles.ts
      provides: Large-list-safe metadata enrichment cutoff
      contains: 'MAX_AUTH_FILES_INLINE_METADATA_DOWNLOADS'
  key_links:
    - from: authFilesApi.list
      to: bounded metadata enrichment
      via: enrichAuthFilesWithPlanMetadata
      pattern: 'MAX_AUTH_FILES_INLINE_METADATA_DOWNLOADS'
---

# Quick Plan: Fix large Auth Files list loading

<objective>
Fix the Auth Files list loading path that becomes unsafe for large lists (6000+ rows) after plan metadata enrichment. The current `authFilesApi.list()` path dedupes `/auth-files`, then `enrichAuthFilesWithPlanMetadata()` can call `authFilesApi.downloadJsonObject(name)` for every row that lacks metadata. At 6000+ files this creates thousands of concurrent `/auth-files/download?name=<file>` requests and can stall or fail the page.

Purpose: keep the Auth Files page load safe for large lists by preventing metadata enrichment from issuing thousands of per-file downloads. Do not send a literal wildcard/glob value as a filename.
Output: a bounded change in `src/services/api/authFiles.ts`; no backend code.
</objective>

<context>
Repository constraints:
- React management UI only; backend Management API must already be running for end-to-end verification.
- Use `pnpm`, not `npm`.
- No test script exists; do not use `pnpm test`.
- Treat management auth-file contents as sensitive: never log raw JSON or secret fields.

Relevant existing interfaces:

```ts
// src/types/authFile.ts
export interface AuthFileItem {
  name: string;
  type?: AuthFileType | string;
  provider?: string;
  disabled?: boolean;
  [key: string]: unknown;
}

export interface AuthFilesResponse {
  files: AuthFileItem[];
  total?: number;
}
```

Current risky path in `src/services/api/authFiles.ts`:

```ts
const enrichAuthFilesWithPlanMetadata = async (
  payload: AuthFilesResponse
): Promise<AuthFilesResponse> => {
  const files = await Promise.all(
    payload.files.map(async (entry) => {
      if (hasAuthFilePlanMetadata(entry)) return entry;
      const name = readTextField(entry, 'name');
      if (!name || isRuntimeOnlyEntry(entry)) return entry;
      const json = await authFilesApi.downloadJsonObject(name);
      return { ...entry, ...pickAuthFilePlanMetadata(json) };
    })
  );
  return { ...payload, files };
};
```

</context>

<tasks>

<task type="auto" tdd="false">
  <name>task 1: bound per-file list enrichment and skip it for large lists</name>
  <files>src/services/api/authFiles.ts</files>
  <action>
    Update only the list-enrichment logic in `src/services/api/authFiles.ts`.

    Change `enrichAuthFilesWithPlanMetadata()` so it first finds entries that are missing metadata, have a non-empty name, and are not runtime-only. If none exist, return the payload unchanged. If the number of missing-metadata entries exceeds `MAX_AUTH_FILES_INLINE_METADATA_DOWNLOADS`, return the payload unchanged instead of downloading each file.

    For small lists only, keep the existing named-file enrichment behavior by calling `authFilesApi.downloadJsonObject(name)` for each missing row and merging only values returned by `pickAuthFilePlanMetadata()`. The list path must never request `download?name=*`.

    Do not change `downloadText`, `downloadPublicText`, `downloadJsonObject`, `downloadPublicJsonObject`, save/upload/delete behavior, or page/component logic. Do not add logging. Do not add new dependencies.

  </action>
  <verify>
    <automated>pnpm exec prettier --write src/services/api/authFiles.ts</automated>
    <automated>pnpm run type-check</automated>
    <automated>pnpm run lint</automated>
    <automated>pnpm run build</automated>
    <manual>With a running backend containing 6000+ auth files, open the Auth Files page and confirm DevTools Network shows no literal wildcard download request and no per-file `/download?name=<file>` fan-out.</manual>
  </verify>
  <done>Auth Files list loading keeps small-list metadata enrichment but skips the unsafe enrichment path for large lists.</done>
</task>

<task type="auto" tdd="false">
  <name>task 2: preserve existing metadata/filter semantics and secret boundary</name>
  <files>src/services/api/authFiles.ts</files>
  <action>
    Inspect the changed `authFilesApi.list()` result shape after task 1. Confirm the returned rows are still deduped by name, sorted by name, and retain `total: normalizedFiles.length` from `dedupeAuthFilesResponse()`.

    Ensure rows that already have any key from `AUTH_FILE_PUBLIC_PLAN_METADATA_KEYS` are not overwritten by bulk metadata. Ensure rows missing metadata receive only keys returned by `pickAuthFilePlanMetadata()`, including `plan`, `plan_type`, `planType`, `tier_id`, `tierId`, `tier_label`, `tierLabel`, `credit_balance`, `creditBalance`, and `probe_quota`.

    Add small private normalization helpers only if needed to keep the parser readable under strict TypeScript. Avoid broad `any`; use `unknown`, `Record<string, unknown>`, and existing `AuthFileEntry`/`Partial<AuthFileEntry>` types.

  </action>
  <verify>
    <automated>pnpm run type-check</automated>
    <automated>pnpm run lint</automated>
    <automated>pnpm run build</automated>
    <manual>With small backend data where `/auth-files` omits `plan_type` but the named auth-file JSON includes it, confirm Advanced filter → Plan type categorizes the row by that plan instead of `No detected plan`.</manual>
  </verify>
  <done>Existing plan-filter metadata behavior is preserved without exposing non-whitelisted auth-file fields in list state.</done>
</task>

</tasks>

<threat_model>

## Trust Boundaries

| Boundary                        | Description                                                                                 |
| ------------------------------- | ------------------------------------------------------------------------------------------- |
| Management API → React UI       | Auth-file JSON crosses from backend into browser memory and may contain secrets.            |
| React UI → Network/browser logs | Raw auth-file payloads must not be logged or exposed beyond intended download/edit actions. |

## STRIDE Threat Register

| Threat ID             | Category | Component                                           | Disposition | Mitigation Plan                                                                                 |
| --------------------- | -------- | --------------------------------------------------- | ----------- | ----------------------------------------------------------------------------------------------- |
| T-quick-260520-r3b-01 | I        | `src/services/api/authFiles.ts` metadata enrichment | mitigate    | Copy only `pickAuthFilePlanMetadata()` fields into list rows; do not log raw auth-file objects. |
| T-quick-260520-r3b-02 | D        | `enrichAuthFilesWithPlanMetadata()`                 | mitigate    | Skip per-file enrichment when the missing-metadata row count exceeds the safe cutoff.           |

</threat_model>

<verification>
Run, in order:

```bash
pnpm exec prettier --write src/services/api/authFiles.ts
pnpm run type-check
pnpm run lint
pnpm run build
```

Backend-backed manual check if available:

1. Start the backend Management API at `http://localhost:8317` with 6000+ auth files.
2. Run `pnpm run dev` and open the Auth Files page.
3. In DevTools Network, verify list load does not create thousands of `/auth-files/download?name=<file>` calls.
4. Verify no literal wildcard/glob value is sent as a download filename.
5. Verify Advanced Plan type filtering still sees plan metadata already present in `/auth-files` rows and still works for small-list inline enrichment.
   </verification>

<success_criteria>

- `authFilesApi.list()` remains the only list-loading entry point used by `useAuthFilesData.loadFiles()`.
- Loading a 6000+ auth-file list does not fan out to 6000+ per-file download requests.
- No literal wildcard/glob value is sent to `/auth-files/download` as a filename.
- Only whitelisted plan/quota metadata is merged into `AuthFileItem` rows.
- `pnpm run type-check`, `pnpm run lint`, and `pnpm run build` pass.
  </success_criteria>

<output>
After implementation, write `.planning/quick/2026-05-20-260520-r3b-large-auth-file-list/SUMMARY.md` with changed files, validation results, and backend manual verification status.
</output>
