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
