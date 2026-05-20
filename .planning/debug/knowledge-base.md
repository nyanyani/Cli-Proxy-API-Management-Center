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
