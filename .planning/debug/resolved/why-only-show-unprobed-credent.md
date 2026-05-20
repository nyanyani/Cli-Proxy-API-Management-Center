---
status: resolved
trigger: "why Only show unprobed credentials + Only show probe-successful credentials + Only show probe-failed credentials less than 1/3 of auth files?"
created: 2026-05-20
updated: 2026-05-20
---

# Debug Session: why-only-show-unprobed-credent

## Symptoms

- expected_behavior: "The Auth Files credential probe filters should account for auth files consistently: unprobed, probe-successful, and probe-failed should explain the visible credential/probe population, or the UI should clearly distinguish files without credentials/status from filtered credentials."
- actual_behavior: "The sum/coverage of 'Only show unprobed credentials', 'Only show probe-successful credentials', and 'Only show probe-failed credentials' appears to be less than one third of all auth files."
- error_messages: "None reported."
- timeline: "Unknown; user asks why this is happening."
- reproduction: "Open the Auth Files view, compare total auth files against the results/counts for 'Only show unprobed credentials', 'Only show probe-successful credentials', and 'Only show probe-failed credentials'."

## Current Focus

- hypothesis: "Second fix should make the probe summary internally consistent by counting probeable credentials, not every auth file, and by showing files without credentials separately."
- test: "User checks real Auth Files data: probe cache total should equal checked + unprobed; checked should equal success + errors + skipped after probes finish; auth-file badge can differ by filesWithoutCredentials."
- expecting: "The previous total mismatch disappears, or any remaining mismatch identifies a different live denominator such as active non-probe filters."
- next_action: "await user confirmation after checking the Auth Files probe summary and unprobed/success/error/skipped filters again"
- reasoning_checkpoint:
    hypothesis: "AuthFilesPage's probe summary and unprobed filter use all auth files as the denominator, but Probe All only operates on files with a normalized auth_index, so files without credentials make the displayed total diverge from the probe/filter buckets. The previous patch also forgot to pass new interpolation values."
    confirming_evidence:
      - "probeCredentials builds targets at AuthFilesPage.tsx:1720-1726 and filters out files where normalizeAuthIndex(file.auth_index ?? file.authIndex) is null."
      - "probeSummary at AuthFilesPage.tsx:1650-1664 computes total/unprobed from files.length rather than the same auth_index-qualified target set."
      - "The render call at AuthFilesPage.tsx:2663-2668 does not pass total/unprobed/skipped despite locale strings requiring those placeholders."
    falsification_test: "If probeSummary used only auth_index-qualified files and passed all placeholders, but total still failed checked + unprobed or checked still failed success + errors + skipped, this hypothesis would be wrong."
    fix_rationale: "Use one explicit probeable-credential predicate for Probe All, summary, and unprobed filtering; show files without credentials separately so auth-file total vs credential total is no longer ambiguous."
    blind_spots: "I still cannot inspect the user's backend data; this is verified by code invariants and build checks rather than exact live counts."
- tdd_checkpoint: ""

## Evidence

- timestamp: 2026-05-20
  checked: Common bug patterns
  found: "Symptom is wrong data/count displayed; quick map points to Data Shape/API Contract and State Management."
  implication: "Prioritize testing whether filter predicates and displayed totals use different data shapes/denominators."

- timestamp: 2026-05-20
  checked: "Auth file API/data normalization and card rendering"
  found: "authFilesApi.list() dedupes by file name and sets total to normalizedFiles.length; useAuthFilesData stores data.files unchanged after API normalization. AuthFileCard displays success/failed usage totals from file.success/file.failed but probe filters are not implemented there."
  implication: "The likely bug is not API list dedupe or card rendering; the probe filter/count logic lives in src/pages/AuthFilesPage.tsx."

- timestamp: 2026-05-20
  checked: "AuthFilesPage probe filter predicates"
  found: "Probe filters are mutually bucketed by probeState[file.name]: success requires probe?.status === 'success'; failed requires 'error'; unprobed requires no probe object at all; skipped is a separate filter requiring probe?.status === 'skipped'."
  implication: "Summing only unprobed + success + error excludes skipped probe states by design."

- timestamp: 2026-05-20
  checked: "AuthFilesPage probe state writers and summary"
  found: "probeCredentials writes status='skipped' for unsupported providers and aborted/stopped probes. probeSummary counts checked/success/errors/authErrors, but does not display skipped or unprobed counts."
  implication: "The UI lets skipped credentials be a large hidden bucket; the summary does not make the partition obvious, explaining why the user's three-filter coverage can be far below total auth files."

- timestamp: 2026-05-20
  checked: "Implemented minimal fix"
  found: "AuthFilesPage probeSummary now returns total, unprobed, and skipped; all locale probe_summary strings now display those counts."
  implication: "The UI now exposes the bucket that was missing from the user's mental sum without changing probe/filter semantics."

- timestamp: 2026-05-20
  checked: "Verification commands"
  found: "pnpm exec prettier --write on touched files succeeded; pnpm run type-check succeeded; pnpm run build succeeded. Vite emitted dist/index.html after tsc."
  implication: "The code change is formatted and passes the strongest available project checks."

- timestamp: 2026-05-20
  checked: "Human verification response"
  found: "User reports: 'the total count doesn't match!' after seeing the added total/skipped/unprobed summary."
  implication: "The first root-cause hypothesis was incomplete; continue investigating denominator mismatch between total and filtered/probe buckets."

- timestamp: 2026-05-20
  checked: "AuthFilesPage probe summary rendering"
  found: "Locale strings include {{total}}, {{unprobed}}, and {{skipped}}, but the t('auth_files.probe_summary') call only passes checked/success/errors/authErrors."
  implication: "The previous fix is partially wired; new placeholders cannot render numeric counts until the component passes those interpolation values."

- timestamp: 2026-05-20
  checked: "AuthFilesPage probe target construction"
  found: "Probe All builds targets from authFilesApi.list().files, then filters out entries without normalizeAuthIndex(file.auth_index ?? file.authIndex); probeSummary.total currently uses files.length instead."
  implication: "The probe operation denominator is probeable credentials with auth_index, not every auth file; files without credentials are counted as unprobed/total even though Probe All never attempts them."

- timestamp: 2026-05-20
  checked: "Implemented second minimal fix"
  found: "Added shared probeable credential helpers, changed unprobed filter and probeSummary to use files with normalized auth_index, displayed filesWithoutCredentials separately, and passed total/unprobed/skipped/filesWithoutCredentials to i18n."
  implication: "The summary now has invariant total = checked + unprobed for probeable credentials, while explaining the difference between auth-file count and credential count."

- timestamp: 2026-05-20
  checked: "Persisted probe status lifecycle"
  found: "Probe status includes transient loading/idle states, but success/error/skipped/unprobed filters only partition final or absent states. readProbeState now discards non-final persisted statuses."
  implication: "Stale loading entries from a reload/interrupted probe cannot remain as another hidden bucket outside success/error/skipped/unprobed."

- timestamp: 2026-05-20
  checked: "Verification commands after second fix"
  found: "pnpm exec prettier --write on touched files succeeded; pnpm run type-check succeeded; pnpm run build succeeded. Vite emitted dist/index.html; build also printed two existing Windows garbled 'system cannot find path specified' messages but exited successfully."
  implication: "The final code is formatted and passes project type-check/build verification."

## Eliminated

- hypothesis: "Only hidden skipped credentials explain the user's mismatch."
  evidence: "After exposing skipped/unprobed/total counts, the user still reports that the total count does not match."
  timestamp: 2026-05-20

## Resolution

- root_cause: "Probe-result filters are a credential-probe partition, not an all-auth-files partition. Probe All only targets files with normalized auth_index/authIndex, but the prior summary/unprobed logic counted every auth file; skipped was also hidden, and the first patch added locale placeholders without passing their interpolation values."
- fix: "Use a shared normalized auth_index predicate for probeable credentials, compute probeSummary total/unprobed from that credential set, exclude files without credentials from the unprobed credential filter, display filesWithoutCredentials separately, and pass all probe summary interpolation values."
- verification: "Self-verified with pnpm exec prettier --write src/pages/AuthFilesPage.tsx src/i18n/locales/{en,zh-CN,zh-TW,ru}.json, pnpm run type-check, and pnpm run build. User confirmed fixed in real Auth Files data."
- files_changed:
    - "src/pages/AuthFilesPage.tsx"
    - "src/i18n/locales/en.json"
    - "src/i18n/locales/zh-CN.json"
    - "src/i18n/locales/zh-TW.json"
    - "src/i18n/locales/ru.json"
