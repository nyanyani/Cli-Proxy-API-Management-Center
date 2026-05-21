# GSD Debug Knowledge Base

Resolved debug sessions. Used by `gsd-debugger` to surface known-pattern hypotheses at the start of new investigations.

---

## has-plan-filter-return-the-wro — Plan filter returned wrong free auth files
- **Date:** 2026-05-20
- **Error patterns:** plan filter, wrong free auth files, free plan, auth files, has plan
- **Root cause:** AuthFilesPage implemented `planFilter` as a ternary "has any plan" boolean filter instead of filtering by normalized plan category; the free-plan classifier existed for sorting but was not used by filtering.
- **Fix:** Replaced the plan filter with a plan-category selector and predicate; added UI state validation and locale strings for Free, Plus/Team, Other, and No detected plan.
- **Files changed:** src/pages/AuthFilesPage.tsx, src/features/authFiles/uiState.ts, src/i18n/locales/en.json, src/i18n/locales/zh-CN.json, src/i18n/locales/zh-TW.json, src/i18n/locales/ru.json
---

## fix-row-and-i18n-and-ui-overlap — Auth Files plan-priority controls showed raw keys and overlapped
- **Date:** 2026-05-20
- **Error patterns:** raw i18n keys, AUTH_FILES.PLAN_PRIORITY, AUTH_FILES.PLAN_ORDER_LABEL, controls overlap, page-size input, Auth Files
- **Root cause:** AuthFilesPage rendered three auth_files.plan_priority_* translation keys that were absent from every locale file. The same control row constrained the plan-priority control to a narrow 96-120px grid column and used nowrap labels, so the long raw fallback key could overflow into adjacent controls such as the page-size input.
- **Fix:** Added plan_priority_order_label, plan_priority_free_first, and plan_priority_plus_team_first translations to en, zh-CN, zh-TW, and ru. Updated AuthFilesPage.module.scss so the view controls have four explicit responsive grid columns and their labels/buttons wrap or stay within their cell instead of overflowing.
- **Files changed:** src/i18n/locales/en.json, src/i18n/locales/zh-CN.json, src/i18n/locales/zh-TW.json, src/i18n/locales/ru.json, src/pages/AuthFilesPage.module.scss
---

## probe-all-credentials-retry — Probe all credentials did not retry transient gateway failures
- **Date:** 2026-05-20
- **Error patterns:** Probe all credentials, retry, Failed to load resource, 502 Bad Gateway, credential probe, transient server error
- **Root cause:** Probe all credentials sends each credential probe through a single api-call attempt. Transient gateway/server failures (HTTP 502/503/504 from the management endpoint, or 502/503/504 returned as api-call statusCode) are treated as final errors immediately because no retry wrapper exists on the probe path.
- **Fix:** Added scoped credential-probe retry handling in src/pages/AuthFilesPage.tsx and changed probeCredentials to call requestProbeWithRetry instead of apiCallApi.request directly.
- **Files changed:** src/pages/AuthFilesPage.tsx
---

## plan-priority-should-be-the-ac — Plan priority was attached to sort controls instead of auth-file edit action
- **Date:** 2026-05-20
- **Error patterns:** plan priority, action button, edit auth files, sort options, priority sort, planPriorityOrder
- **Root cause:** AuthFilesPage still had the plan-priority sort/order implementation in live source: `sortMode === 'priority'` ranked by `getPlanPriorityRank(...)` before editable `file.priority`, `planPriorityOrder` was persisted in UI state, and a plan-priority button was rendered beside the sort selector. The previous debug note claimed this was removed, but current working-tree evidence showed it was not.
- **Fix:** Removed the live plan-priority order type/state/persistence/toggle UI from AuthFilesPage and uiState, restored priority sort to use only the auth-file `priority` value that is edited through Auth File Details / Edit, and removed stale `plan_priority_*` locale keys.
- **Files changed:** src/pages/AuthFilesPage.tsx, src/features/authFiles/uiState.ts, src/i18n/locales/en.json, src/i18n/locales/zh-CN.json, src/i18n/locales/zh-TW.json, src/i18n/locales/ru.json
---

## probe-result-should-update-the — Probe results did not update quota cards
- **Date:** 2026-05-20
- **Error patterns:** probe result, quota card, quota cards, disabled credentials, Auth Files, quota state
- **Root cause:** Probe-to-quota updates reused quota config filterFn predicates as provider resolvers. Those predicates are UI visibility filters that exclude disabled files, while probeCredentials includes disabled files when probing all/disabled targets. As a result, getProbeQuotaConfig returned null and skipped quota store updates for disabled probed files.
- **Fix:** Changed getProbeQuotaConfig in AuthFilesPage to resolve quota config by normalized provider instead of quota-list filterFn, while preserving runtime-only exclusion for Gemini CLI.
- **Files changed:** src/pages/AuthFilesPage.tsx
---

## add-an-option-to-configure-whe — Configurable filter changes clear Auth Files selection
- **Date:** 2026-05-20
- **Error patterns:** selected filters change, clear selection, configurable option, Auth Files, filter changes
- **Root cause:** AuthFilesPage had no configurable state transition for filter changes to clear selected auth files; filter/search handlers were independent direct setters and selection state was managed separately by useAuthFilesData.
- **Fix:** Added persisted `clearSelectionOnFilterChange` Auth Files UI option, a shared `commitFilterChange` helper that clears selection only when enabled and the filter value changes, wired filter/search handlers through it, and added locale labels.
- **Files changed:** src/pages/AuthFilesPage.tsx, src/features/authFiles/uiState.ts, src/i18n/locales/en.json, src/i18n/locales/zh-CN.json, src/i18n/locales/zh-TW.json, src/i18n/locales/ru.json
---

## i-selected-the-no-detected-pla — Probe selected left successfully detected files under No detected plan
- **Date:** 2026-05-20
- **Error patterns:** No detected plan, probe selected, auth files left, Probe cache, plan_type free, API-call envelope body
- **Root cause:** The No detected plan workflow had multiple missing plan-normalization paths. AuthFilesPage ignored Gemini CLI quota tier identifiers, and Codex/OpenAI quota parsing returned API-call envelope objects directly without parsing the nested JSON `body` that contained `plan_type='free'`.
- **Fix:** Added quota `tierId`/`tier_id` fields to AuthFilesPage plan resolution and updated `parseCodexUsagePayload` to unwrap nested API-call envelope body payloads before deriving Codex planType.
- **Files changed:** src/pages/AuthFilesPage.tsx, src/utils/quota/parsers.ts
---

## probe-didnt-retry-502 — Probe retried 502 responses then surfaced final failure
- **Date:** 2026-05-20
- **Error patterns:** probe didn't retry, 502 Bad Gateway, request failed, credential probe, three attempts
- **Root cause:** The UI did not skip retrying. Current AuthFilesPage retries probe HTTP/api-call 502/503/504 responses up to PROBE_MAX_ATTEMPTS=3; the real failing workflow made all three attempts and then surfaced the final 502 after retry exhaustion.
- **Fix:** No source-code change required for the reported "didn't retry" symptom. Existing implementation already retries thrown ApiError.status 502 and api-call result statusCode 502 up to PROBE_MAX_ATTEMPTS=3.
- **Files changed:** .planning/debug/resolved/probe-didnt-retry-502.md
---

## probe-selected-did-not-update — Probe selected quota and plan updates did not persist
- **Date:** 2026-05-20
- **Error patterns:** Probe selected, quota, Plan type, did not update, did not persist, refresh, reload, re-fetch, No detected plan, Gemini CLI, probe_quota
- **Root cause:** Probe selected originally refreshed volatile quota store state only. After adding persistence, Gemini CLI still failed because its detected tier/plan metadata was produced by an asynchronous loadCodeAssist side-channel after fetchGeminiCliQuota returned; the persistence step captured and saved the earlier quota state where tierLabel/tierId were null, leaving the auth file classified as "No detected plan".
- **Fix:** Added a post-quota-refresh persistence step in AuthFilesPage that writes compact probe_quota metadata plus top-level plan_type/tier_id/tier_label/credit_balance fields into each successful auth file JSON via authFilesApi.downloadJsonObject/saveJsonObject. Also changed Gemini CLI quota fetching to await loadCodeAssist tier metadata before returning the success state. Added probe_quota readback so resolvePlanTypeForFile checks persisted probe_quota metadata/data, AuthFilesPage quota-state lookup falls back to probe_quota.data after reload, and AuthFileQuotaSection displays persisted probe quota data when useQuotaStore is empty.
- **Files changed:** src/pages/AuthFilesPage.tsx, src/components/quota/quotaConfigs.ts, src/features/authFiles/components/AuthFileQuotaSection.tsx
---

## auth-file-plan-filter — Auth file JSON leaked probe metadata and plan filter missed downloaded plan_type
- **Date:** 2026-05-20
- **Error patterns:** Auth file JSON, probe_quota, Advanced filter, Plan type, No detected plan, Codex, plan_type free, list summary
- **Root cause:** Two separate auth-file JSON boundary issues were present. First, user-facing auth-file JSON paths reused raw backend auth-file records, so UI-internal `probe_quota` metadata leaked into download/export and editor JSON display. Second, Advanced Plan type filtering operates on `/auth-files` list-summary rows; those rows can omit persisted raw auth JSON fields such as top-level `plan_type`, so a downloaded Codex auth record with `plan_type: "free"` could still be categorized as `No detected plan` because the filter never received that field.
- **Fix:** Added a shallow auth-file public JSON sanitizer that omits `probe_quota`; used it for single/batch downloads and prefix/proxy editor JSON display/preview while keeping probe metadata persistence writes unchanged. Added list-row enrichment that copies only whitelisted non-secret plan/quota metadata from raw auth JSON into `/auth-files` list items when the list summary lacks plan metadata.
- **Files changed:** src/services/api/authFiles.ts, src/features/authFiles/hooks/useAuthFilesData.ts, src/features/authFiles/hooks/useAuthFilesPrefixProxyEditor.ts
---

## why-only-show-unprobed-credent — Probe filters used a different denominator than auth-file totals
- **Date:** 2026-05-20
- **Error patterns:** Only show unprobed credentials, Only show probe-successful credentials, Only show probe-failed credentials, less than 1/3, total count doesn't match, auth files, probe summary
- **Root cause:** Probe-result filters are a credential-probe partition, not an all-auth-files partition. Probe All only targets files with normalized auth_index/authIndex, but the prior summary/unprobed logic counted every auth file; skipped was also hidden, and the first patch added locale placeholders without passing their interpolation values.
- **Fix:** Use a shared normalized auth_index predicate for probeable credentials, compute probeSummary total/unprobed from that credential set, exclude files without credentials from the unprobed credential filter, display filesWithoutCredentials separately, and pass all probe summary interpolation values.
- **Files changed:** src/pages/AuthFilesPage.tsx, src/i18n/locales/en.json, src/i18n/locales/zh-CN.json, src/i18n/locales/zh-TW.json, src/i18n/locales/ru.json
---

## priority-batch-set-action — Batch priority needed clear semantics and bounded bulk requests
- **Date:** 2026-05-21
- **Error patterns:** batch priority, set priority, clear priority, remove priority, priority 0, net::ERR_INSUFFICIENT_RESOURCES, bulk batch action, auth files
- **Root cause:** Two issues were found in sequence. First, the initial batch priority implementation had no clear-priority path and treated backend deletion signal priority=0 as a real local priority value. After that was fixed, large bulk batch priority still failed because batchSetPriority launched one concurrent PATCH /auth-files/fields request per selected file with Promise.allSettled, causing browser/network resource exhaustion (net::ERR_INSUFFICIENT_RESOURCES) for large selections.
- **Fix:** Kept the numeric Set priority action, added a batch Clear priority action that sends priority 0 for selected non-runtime auth files, changed batchSetPriority optimistic/success/rollback state so priority 0 deletes the local priority field while failures restore whether priority originally existed, and capped per-file batch mutation requests with runLimitedSettled/BATCH_MUTATION_CONCURRENCY=4 for both batchSetPriority and batchSetStatus. Added localized Clear priority labels.
- **Files changed:** src/pages/AuthFilesPage.tsx, src/pages/AuthFilesPage.module.scss, src/i18n/locales/en.json, src/i18n/locales/zh-CN.json, src/i18n/locales/zh-TW.json, src/i18n/locales/ru.json, src/features/authFiles/hooks/useAuthFilesData.ts
---

## why-quota-api-call-not-patch — Quota metadata persistence used unsupported fields PATCH for free-plan updates
- **Date:** 2026-05-21
- **Error patterns:** quota API call, not patch, auth-files/fields, probe_quota, plan_type free, no fields to update, free plan, batch probe, disabled
- **Root cause:** Multiple quota refresh/probe paths originally bypassed shared persistence. After those paths were centralized, free-plan metadata still attempted PATCH /auth-files/fields before disabled status handling, but the current backend ignores probe_quota/plan_type/tier_id/tier_label/credit_balance on /auth-files/fields and returns HTTP 400 "no fields to update".
- **Fix:** Centralized quota metadata persistence across AuthFilesPage probes, QuotaSection/useQuotaLoader, and AuthFileQuotaSection. Free-plan metadata now saves quota metadata through the auth-file JSON upload path, then disables through PATCH /auth-files/status when needed, and returns before PATCH /auth-files/fields. Non-free metadata keeps the PATCH-first compatibility path.
- **Files changed:** src/utils/quota/parsers.ts, src/components/quota/persistQuotaMetadata.ts, src/components/quota/useQuotaLoader.ts, src/components/quota/QuotaSection.tsx, src/features/authFiles/components/AuthFileQuotaSection.tsx, src/pages/AuthFilesPage.tsx, src/services/api/authFiles.ts
---
