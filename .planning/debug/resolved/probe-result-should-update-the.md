---
status: resolved
trigger: "probe result should update the list of quato card"
created: 2026-05-20
updated: 2026-05-20T00:00:05Z
---

# Debug Session: probe-result-should-update-the

## Symptoms

- expected_behavior: Probe result should update the list of quota cards.
- actual_behavior: Probe result does not update the list of quota cards.
- error_messages: Not provided.
- timeline: Not provided.
- reproduction: Trigger a probe and observe whether the quota card list updates with the probe result.

## Current Focus

- hypothesis: Probe writes quota states using quota config filters that exclude disabled files, so probing disabled credentials cannot update quota-card state for those probed files.
- test: Human verification in the real UI/backend workflow.
- expecting: After probing disabled or selected credentials, matching visible Auth Files quota-card sections update from idle to loading/success/error instead of remaining unchanged.
- next_action: Archive resolved debug session and update knowledge base.
- reasoning_checkpoint:
    hypothesis: "Probe result quota-card updates are skipped for disabled credentials because getProbeQuotaConfig reuses quota config filterFn predicates, and those predicates include !isDisabledAuthFile(file), while probeCredentials intentionally includes disabled files when probing all/disabled targets."
    confirming_evidence:
      - "probeCredentials builds targets from authFilesApi.list() filtered only by targetNames and auth_index; disabled files are not filtered out."
      - "All quota config filterFn predicates read include !isDisabledAuthFile(file), so getProbeQuotaConfig(file) returns null for disabled Claude/Antigravity/Codex/Gemini CLI/Kimi files."
      - "refreshQuotaCacheForProbeResults writes quota state only after getProbeQuotaConfig returns a config; AuthFileQuotaSection reads that quota state by the same file.name key and displays it on auth-file cards even when refresh controls are disabled."
    falsification_test: "If getProbeQuotaConfig used provider matching independent of disabled status, or probeCredentials excluded disabled files, disabled probe results would not be skipped by this mechanism."
    fix_rationale: "A probe result is evidence about the credential regardless of UI visibility/disabled status, so the probe path needs a provider-to-quota-config resolver separate from QuotaPage's visible-card filterFn."
    blind_spots: "No backend is available here to perform an end-to-end browser probe; verification will be static plus TypeScript/build checks."
- reasoning_checkpoint:
- tdd_checkpoint:

## Evidence

- timestamp: 2026-05-20T00:00:01Z
  checked: Knowledge base for overlapping probe/quota/card patterns.
  found: Existing entries cover plan filtering and i18n/control overlap; no overlap with probe result or quota card state update.
  implication: No known-pattern shortcut applies.

- timestamp: 2026-05-20T00:00:01Z
  checked: src/pages/AuthFilesPage.tsx probe flow and quota refresh helpers.
  found: probeCredentials builds targets from authFilesApi.list() by optional targetNames and auth_index only; it does not exclude disabled auth files. Successful and failed probe targets are later passed to refreshQuotaCacheForProbeResults, which calls getProbeQuotaConfig(file) before writing quota state.
  implication: Probe target inclusion and quota-state write inclusion are controlled by different predicates.

- timestamp: 2026-05-20T00:00:01Z
  checked: src/components/quota/quotaConfigs.ts config predicates and src/components/quota/QuotaSection.tsx card rendering.
  found: Every quota config filterFn includes !isDisabledAuthFile(file). Quota cards read useQuotaStore by item.name, and AuthFilesPage setQuotaResult writes the same store by file.name only if getProbeQuotaConfig returns a config.
  implication: Disabled files can be probed but their probe results are skipped by quota-state updates because getProbeQuotaConfig delegates to quota config UI visibility filters.

- timestamp: 2026-05-20T00:00:02Z
  checked: src/features/authFiles/components/AuthFileCard.tsx and AuthFileQuotaSection.tsx.
  found: AuthFileCard displays AuthFileQuotaSection whenever a quota provider filter is active and the file is not runtime-only/non-compact; it does not hide quota state for disabled files. AuthFileQuotaSection only disables manual refresh for disabled files but still renders any existing quota state from useQuotaStore by file.name.
  implication: Probe should be able to populate quota card content for disabled-file cards, but the current probe-to-quota config lookup prevents those store writes.

- timestamp: 2026-05-20T00:00:04Z
  checked: pnpm run type-check && pnpm run build after changing getProbeQuotaConfig.
  found: TypeScript failed because QUOTA_CONFIGS became unused after getProbeQuotaConfig stopped searching the config array.
  implication: The resolver change needs to remove the obsolete array to satisfy strict noUnusedLocals.

- timestamp: 2026-05-20T00:00:05Z
  checked: pnpm run type-check after removing QUOTA_CONFIGS.
  found: TypeScript completed successfully.
  implication: The fix compiles under strict TypeScript settings.

- timestamp: 2026-05-20T00:00:05Z
  checked: pnpm run build.
  found: Production build completed successfully with Vite. The command printed two garbled Windows "system cannot find the path specified" messages before Vite output, but exited successfully and produced dist/index.html.
  implication: Build verification passed; the Windows path messages are non-fatal and not introduced by the probe resolver change.

- timestamp: 2026-05-20T00:00:06Z
  checked: Human verification response.
  found: User confirmed the fix works in the real UI/backend workflow.
  implication: Original probe-to-quota-card update issue is resolved end-to-end.

## Eliminated

## Resolution

- root_cause: Probe-to-quota updates reused quota config filterFn predicates as provider resolvers. Those predicates are UI visibility filters that exclude disabled files, while probeCredentials includes disabled files when probing all/disabled targets. As a result, getProbeQuotaConfig returned null and skipped quota store updates for disabled probed files.
- fix: Changed getProbeQuotaConfig in AuthFilesPage to resolve quota config by normalized provider instead of quota-list filterFn, while preserving runtime-only exclusion for Gemini CLI.
- verification: Static verification confirms the old resolver skipped disabled files and the new provider resolver does not; pnpm run type-check passed; pnpm run build passed; user confirmed fixed in the real UI/backend workflow.
- files_changed:
  - src/pages/AuthFilesPage.tsx
