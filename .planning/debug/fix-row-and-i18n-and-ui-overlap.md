---
slug: fix-row-and-i18n-and-ui-overlap
status: verifying
trigger: user_report
goal: find_and_fix
tdd_mode: false
created: 2026-05-20
updated: 2026-05-20T00:00:05Z
---

# Debug Session: fix-row-and-i18n-and-ui-overlap

## Current Focus

reasoning_checkpoint:
  hypothesis: "Auth Files view controls show raw i18n keys and overlap because the three plan-priority locale entries are absent in every locale, and the plan-priority control is constrained to a 96-120px grid column with nowrap labels/button text that can overflow into the adjacent page-size input."
  confirming_evidence:
    - "AuthFilesPage.tsx renders auth_files.plan_priority_order_label, auth_files.plan_priority_free_first, and auth_files.plan_priority_plus_team_first at lines 2077-2083."
    - "A direct Node check reported all three keys missing from en, zh-CN, zh-TW, and ru locale JSON files."
    - "AuthFilesPage.module.scss .viewControls uses grid-template-columns: minmax(160px, 1fr) minmax(96px, 120px) minmax(180px, 1fr), while the JSX renders four controls and .filterItem label has white-space: nowrap."
  falsification_test: "After adding the missing keys and widening/constraining the viewControls grid, a repeated locale-key check should report all present, and type/build checks should compile the modified TSX/JSON/SCSS without errors."
  fix_rationale: "Adding the locale keys removes raw fallback-key text; making the view controls a four-column grid with minmax(0, ...) cells and wrapping/contained labels/buttons prevents translated text from overflowing into neighboring controls."
  blind_spots: "Cannot visually verify against the user's exact backend data in this session; final real-workflow confirmation is still required after self-verification."
next_action: Run pnpm run type-check, pnpm run lint, and pnpm run build to verify the locale and SCSS changes compile cleanly.

## Evidence

- timestamp: 2026-05-20T00:00:00Z
  source: user_report
  observation: Screenshot/report shows Auth Files controls overlapping/misaligned; raw i18n keys visible including AUTH_FILES.PLAN_PRIORITY_FREE... and AUTH_FILES.PLAN_ORDER_LABEL; labels collide with nearby controls/input values such as numeric input "30".
- timestamp: 2026-05-20T00:00:01Z
  checked: common bug patterns
  found: Symptoms match missing user-facing copy/data key and CSS/layout constraint categories rather than null/async/API categories.
  implication: First tests should inspect i18n resource coverage and the layout container for Auth Files controls.
- timestamp: 2026-05-20T00:00:02Z
  checked: AuthFilesPage view controls and locale resources
  found: AuthFilesPage.tsx renders auth_files.plan_priority_order_label, auth_files.plan_priority_free_first, and auth_files.plan_priority_plus_team_first at lines 2077-2083, but grep found no matching keys in any locale JSON file. AuthFilesPage.module.scss defines .viewControls as three grid columns while the JSX renders four filterItem controls; the plan-priority column is minmax(96px, 120px) and filter labels are white-space: nowrap.
  implication: Raw i18n keys are caused by missing locale entries. The overlap is caused by those raw/long labels and button text being placed in a deliberately narrow, non-wrapping control column, with no min-width/overflow guard on the button.
- timestamp: 2026-05-20T00:00:03Z
  checked: direct locale key assertion
  found: Node check reported en, zh-CN, zh-TW, and ru all missing plan_priority_order_label, plan_priority_free_first, and plan_priority_plus_team_first under auth_files.
  implication: Missing i18n keys are confirmed; proceed with a targeted locale and layout fix.
- timestamp: 2026-05-20T00:00:05Z
  checked: formatting and locale key assertion after fix
  found: Prettier reported touched files unchanged; repeated Node assertion reported all three plan-priority keys present in en, zh-CN, zh-TW, and ru.
  implication: The raw-key half of the bug is fixed at the resource level; proceed to project checks for regressions.

## Investigation Log

## Specialist Review

## Resolution

- root_cause: AuthFilesPage rendered three auth_files.plan_priority_* translation keys that were absent from every locale file. The same control row constrained the plan-priority control to a narrow 96-120px grid column and used nowrap labels, so the long raw fallback key could overflow into adjacent controls such as the page-size input.
- fix: Added plan_priority_order_label, plan_priority_free_first, and plan_priority_plus_team_first translations to en, zh-CN, zh-TW, and ru. Updated AuthFilesPage.module.scss so the view controls have four explicit responsive grid columns and their labels/buttons wrap or stay within their cell instead of overflowing.
- verification: pending
- files_changed:
  - src/i18n/locales/en.json
  - src/i18n/locales/zh-CN.json
  - src/i18n/locales/zh-TW.json
  - src/i18n/locales/ru.json
  - src/pages/AuthFilesPage.module.scss
