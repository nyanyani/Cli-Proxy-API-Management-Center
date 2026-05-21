---
status: resolved
trigger: "Continue debugging why-quota-api-call-not-patch. New feedback: handle persist after every small batch run, do not wait for all probe done in batch Probe credentials. Preserve free-plan behavior: free-plan quota metadata persists through auth-file JSON save and disables through PATCH /auth-files/status, not unsupported PATCH /auth-files/fields. Non-free behavior keeps existing shared helper semantics."
created: 2026-05-21T00:00:00Z
updated: 2026-05-21T07:40:00Z
---

## Current Focus

hypothesis: "Chunking AuthFilesPage Probe credentials by PROBE_CONCURRENCY and running the existing quota refresh/persist stage after each chunk fixes persistence timing without changing the shared free-plan/non-free helper semantics."
test: "Human verifies Auth Files Probe credentials in the real backend/browser Network panel with more than PROBE_CONCURRENCY probe targets."
expecting: "After the first bounded chunk finishes its credential and quota probes, quota metadata persistence requests appear before later full-run target chunks finish. Free-plan targets use JSON save plus PATCH /auth-files/status; non-free targets keep existing shared helper behavior."
next_action: "Wait for user to run batch Probe credentials in the real workflow and report 'confirmed fixed' or provide fresh Network/HAR evidence if persistence still waits until the full run completes."

reasoning_checkpoint:
  hypothesis: "AuthFilesPage batch Probe credentials waits to persist because persistence is scheduled after the global runLimited(targets, PROBE_CONCURRENCY, ...) call, not after each bounded chunk."
  confirming_evidence:
    - "AuthFilesPage.probeCredentials lines 1619-1690 creates global successfulTargets/failedTargets and awaits runLimited over all targets."
    - "Only after that full await returns, lines 1698-1714 call refreshQuotaCacheForProbeResults and persistProbeQuotaMetadata once."
    - "persistProbeQuotaMetadata already delegates to the shared helper, whose free-plan branch saves JSON plus PATCH /auth-files/status before returning; preserving that call preserves existing semantics."
  falsification_test: "If persistProbeQuotaMetadata were already called inside the per-target worker or inside runLimited after each concurrency batch, the user's timing issue would be elsewhere; static inspection shows no such call until after runLimited completes."
  fix_rationale: "Moving the quota refresh/persist stage into a bounded chunk loop changes only timing: each chunk's successful probe results persist immediately through the same shared helper instead of being accumulated for the final full-run persistence."
  blind_spots: "No local Management API backend is available to observe real Network timing; verification can prove static call placement and compile/build success, while user must confirm end-to-end timing."

## Symptoms

expected: "In Auth Files 'Probe credentials' batch mode, successful quota metadata should persist after every bounded/small probe batch completes, not only after all credentials in the full batch finish. Free-plan quota metadata must persist through auth-file JSON save and disable via PATCH /auth-files/status, while non-free behavior keeps existing shared helper semantics."
actual: "User reports batch Probe credentials waits until all probe requests finish before quota metadata is persisted."
errors: "No exception provided. Prior resolved evidence includes unsupported PATCH /auth-files/fields 400 for free-plan metadata, which must not regress."
reproduction: "Open /management.html#/auth-files, run Probe credentials in batch mode over multiple credentials, observe quota metadata persistence timing in Network/state."
started: "After prior quota persistence fixes; newly reported continuation on 2026-05-21."

## Eliminated


## Evidence

- timestamp: 2026-05-21T06:45:00Z
  checked: "Prior resolved debug session .planning/debug/resolved/why-quota-api-call-not-patch.md and new user feedback"
  found: "Previous session centralized quota persistence in persistQuotaMetadataForFile/persistQuotaMetadataForTargets and fixed free-plan behavior by saving JSON plus PATCH /auth-files/status before returning, while AuthFilesPage batch probe uses the shared helper. New issue is persistence timing within batch Probe credentials: persist after each small bounded batch instead of waiting for the entire probe run."
  implication: "Investigate call placement in AuthFilesPage.probeCredentials. Desired fix should change scheduling/placement only and preserve shared helper semantics."

- timestamp: 2026-05-21T07:00:00Z
  checked: "AuthFilesPage.probeCredentials batching and shared quota persistence helper"
  found: "probeCredentials accumulates successfulTargets/failedTargets across all credential probes, awaits runLimited over every target, then calls refreshQuotaCacheForProbeResults and persistProbeQuotaMetadata once. persistProbeQuotaMetadata still calls persistQuotaMetadataForTargets, and persistQuotaMetadataForFile still handles free-plan metadata via auth-file JSON save plus authFilesApi.setStatus before returning without patchFields."
  implication: "Root cause confirmed: the timing bug is call placement, not helper semantics. Fix should chunk targets and run the existing quota refresh/persist stage after each chunk."

- timestamp: 2026-05-21T07:10:00Z
  checked: "Minimal timing fix implementation"
  found: "Changed AuthFilesPage.probeCredentials to iterate targets in PROBE_CONCURRENCY-sized slices. For each slice, it collects only that slice's successful/failed credential probe results, refreshes quota for that slice, calls persistProbeQuotaMetadata for that slice's successful quota results, updates failures, then proceeds to the next slice."
  implication: "Persistence now happens after each bounded probe chunk instead of after all targets. Because the unchanged persistProbeQuotaMetadata helper is still used, free-plan JSON-save/status-disable behavior and non-free PATCH-first/fallback behavior are preserved."

- timestamp: 2026-05-21T07:25:00Z
  checked: "Validation after per-batch persistence timing fix"
  found: "Ran pnpm exec prettier --write src/pages/AuthFilesPage.tsx, pnpm run type-check, pnpm run lint, and pnpm run build successfully. Build again printed two Windows path warning lines before Vite output but completed. Static inspection confirms persistProbeQuotaMetadata is inside the PROBE_CONCURRENCY-sized batch loop."
  implication: "Local validation passes and source now implements per-small-batch persistence. End-to-end Network timing still needs the user's backend/browser confirmation."

## Resolution

root_cause: "AuthFilesPage Probe credentials persisted quota metadata only after the full run because refreshQuotaCacheForProbeResults and persistProbeQuotaMetadata were called once after runLimited finished all targets."
fix: "Refactored AuthFilesPage.probeCredentials so the existing quota refresh and persistProbeQuotaMetadata stage runs inside a loop over PROBE_CONCURRENCY-sized target slices."
files_changed: ["src/pages/AuthFilesPage.tsx"]
verification: "Self-verified with prettier on src/pages/AuthFilesPage.tsx; pnpm run type-check; pnpm run lint; pnpm run build. Static inspection confirms per-batch persistence placement. User confirmed fixed in the real browser/backend workflow on 2026-05-21."
