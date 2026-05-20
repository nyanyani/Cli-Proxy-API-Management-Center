---
status: investigating
trigger: "probe result should update the list of quato card"
created: 2026-05-20
updated: 2026-05-20T00:00:01Z
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
- test: Inspect getProbeQuotaConfig, quota config filterFn implementations, probe target selection, and quota card/store key usage for mismatched inclusion rules.
- expecting: If true, probe target selection includes disabled files while getProbeQuotaConfig returns null for disabled files because each config.filterFn requires !isDisabledAuthFile(file).
- next_action: Verify whether probe target selection includes disabled files and whether quota card state writes are skipped for disabled probed files by getProbeQuotaConfig.
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

## Eliminated

## Resolution

- root_cause:
- fix:
- verification:
- files_changed:
