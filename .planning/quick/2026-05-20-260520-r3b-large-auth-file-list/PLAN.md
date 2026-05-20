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
status: ready
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
    - Loading Auth Files uses one bulk `/auth-files/download?name=*` request when list rows need plan/quota metadata enrichment.
    - Advanced Plan type filtering still receives whitelisted plan/quota fields from auth-file JSON when `/auth-files` list rows omit them.
    - Sensitive auth-file secrets are not copied into React list state and are never logged.
  artifacts:
    - path: src/services/api/authFiles.ts
      provides: Bulk metadata enrichment for large auth-file lists
      contains: "/auth-files/download?name=*"
  key_links:
    - from: authFilesApi.list
      to: bulk wildcard download
      via: enrichAuthFilesWithPlanMetadata
      pattern: "download\\?name=\\*"
---

# Quick Plan: Fix large Auth Files list loading

<objective>
Fix the Auth Files list loading path that becomes unsafe for large lists (6000+ rows) after plan metadata enrichment. The current `authFilesApi.list()` path dedupes `/auth-files`, then `enrichAuthFilesWithPlanMetadata()` can call `authFilesApi.downloadJsonObject(name)` for every row that lacks metadata. At 6000+ files this creates thousands of concurrent `/auth-files/download?name=<file>` requests and can stall or fail the page.

Purpose: keep the prior plan-filter behavior while changing enrichment from per-file downloads to one backend-supported wildcard request: `/v0/management/auth-files/download?name=*`.
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
const enrichAuthFilesWithPlanMetadata = async (payload: AuthFilesResponse): Promise<AuthFilesResponse> => {
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
  <name>task 1: replace per-file list enrichment with wildcard bulk metadata loading</name>
  <files>src/services/api/authFiles.ts</files>
  <action>
    Update only the list-enrichment logic in `src/services/api/authFiles.ts`.

    Implement a private helper near the existing metadata helpers that requests raw text/blob from exactly `/auth-files/download?name=*` using `apiClient.getRaw(..., { responseType: 'blob' })`, converts the response to text, parses it as JSON, and builds a `Map<string, Partial<AuthFileEntry>>` keyed by auth-file name. The map values must be produced only through the existing `pickAuthFilePlanMetadata()` whitelist; do not copy whole auth-file objects into list state.

    Make the parser accept the practical bulk shapes without storing secrets longer than needed:
    - `{ files: [...] }`, `{ items: [...] }`, or a top-level array, where each item has `name` plus metadata fields or nested JSON/content fields.
    - A record keyed by filename where each value is an object or a JSON string containing the auth-file object.
    - If a value is a JSON string, parse it and whitelist only metadata fields.

    Then change `enrichAuthFilesWithPlanMetadata()` so it first finds entries that are missing metadata, have a non-empty name, and are not runtime-only. If none exist, return the payload unchanged. Otherwise call the wildcard helper once, then merge whitelisted metadata into each missing row by name. Remove the current `Promise.all(payload.files.map(...downloadJsonObject(name)))` behavior entirely; the list path must not make per-file download requests.

    Do not change `downloadText`, `downloadPublicText`, `downloadJsonObject`, `downloadPublicJsonObject`, save/upload/delete behavior, or page/component logic. Do not add logging. Do not add new dependencies.
  </action>
  <verify>
    <automated>pnpm exec prettier --write src/services/api/authFiles.ts</automated>
    <automated>pnpm run type-check</automated>
    <automated>pnpm run lint</automated>
    <automated>pnpm run build</automated>
    <manual>With a running backend containing 6000+ auth files, open the Auth Files page and confirm DevTools Network shows one `/v0/management/auth-files/download?name=*` request during list metadata enrichment, not thousands of per-file `/download?name=<file>` requests.</manual>
  </verify>
  <done>Auth Files list loading keeps plan metadata enrichment but the loading path uses one wildcard request and no per-file download fan-out.</done>
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
    <manual>With backend data where `/auth-files` omits `plan_type` but wildcard download includes it, confirm Advanced filter → Plan type categorizes the row by that plan instead of `No detected plan`.</manual>
  </verify>
  <done>Existing plan-filter metadata behavior is preserved without exposing non-whitelisted auth-file fields in list state.</done>
</task>

</tasks>

<threat_model>
## Trust Boundaries

| Boundary | Description |
|----------|-------------|
| Management API → React UI | Auth-file JSON crosses from backend into browser memory and may contain secrets. |
| React UI → Network/browser logs | Raw auth-file payloads must not be logged or exposed beyond intended download/edit actions. |

## STRIDE Threat Register

| Threat ID | Category | Component | Disposition | Mitigation Plan |
|-----------|----------|-----------|-------------|-----------------|
| T-quick-260520-r3b-01 | I | `src/services/api/authFiles.ts` bulk parser | mitigate | Copy only `pickAuthFilePlanMetadata()` fields into list rows; do not store or log raw wildcard auth-file objects. |
| T-quick-260520-r3b-02 | D | `enrichAuthFilesWithPlanMetadata()` | mitigate | Replace thousands of concurrent per-file requests with one wildcard request; keep no per-file fan-out in `authFilesApi.list()`. |
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
4. Verify at most one `/v0/management/auth-files/download?name=*` call happens for metadata enrichment.
5. Verify Advanced Plan type filtering still sees plan metadata from auth JSON.
</verification>

<success_criteria>
- `authFilesApi.list()` remains the only list-loading entry point used by `useAuthFilesData.loadFiles()`.
- Loading a 6000+ auth-file list does not fan out to 6000+ per-file download requests.
- The wildcard request path is exactly `/auth-files/download?name=*` under the configured `/v0/management` base.
- Only whitelisted plan/quota metadata is merged into `AuthFileItem` rows.
- `pnpm run type-check`, `pnpm run lint`, and `pnpm run build` pass.
</success_criteria>

<output>
After implementation, write `.planning/quick/2026-05-20-260520-r3b-large-auth-file-list/SUMMARY.md` with changed files, validation results, and backend manual verification status.
</output>
