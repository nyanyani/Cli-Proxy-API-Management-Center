---
status: resolved
trigger: "why quota api call not patch /management/auth-files/fields to presist?"
created: 2026-05-21
updated: 2026-05-21T06:30:00Z
---

# Debug Session: why-quota-api-call-not-patch

## Symptoms

- expected_behavior: "Quota-related probe/update flow should persist detected auth-file field changes by sending PATCH /management/auth-files/fields, or the apiClient-normalized /v0/management/auth-files/fields endpoint, so values survive refresh/reload."
- actual_behavior: "Reported quota API call does not PATCH /management/auth-files/fields to persist."
- error_messages: "Not provided."
- timeline: "Not provided."
- reproduction: "Not provided beyond triggering the quota/auth-files flow and observing no /management/auth-files/fields PATCH persistence request."

## Current Focus

- hypothesis: "Free-plan quota results still send the unsupported PATCH /auth-files/fields body because persistQuotaMetadataForFile attempts patchFields before it checks isFreePlanMetadata; batch probe already uses the same helper via persistQuotaMetadataForTargets, so fixing helper order will apply to batch too."
- test: "Change persistQuotaMetadataForFile so free-plan metadata saves quota metadata through JSON upload and disables via /auth-files/status without calling patchFields; keep non-free metadata on the existing PATCH-first/fallback path. Then run static search plus type/lint/build."
- expecting: "Free-plan card refresh and AuthFilesPage batch probe paths both call the shared helper, and the shared helper no longer emits PATCH /auth-files/fields for free-plan metadata such as { plan_type: 'free', probe_quota: ... }."
- next_action: "Wait for user to verify free-plan card refresh and batch probe in the browser Network panel: free-plan results should not send PATCH /v0/management/auth-files/fields with probe_quota, should save quota metadata via auth-file JSON upload, and should send PATCH /v0/management/auth-files/status with disabled true when not already disabled."
- reasoning_checkpoint:
    hypothesis: "Free-plan quota results still send the unsupported PATCH /auth-files/fields body because persistQuotaMetadataForFile calls authFilesApi.patchFields before checking isFreePlanMetadata; batch probe uses this same helper through persistQuotaMetadataForTargets."
    confirming_evidence:
      - "User's fresh verification shows PATCH /auth-files/fields body with probe_quota and plan_type: free after the previous status-disable fix."
      - "persistQuotaMetadataForFile lines 137-152 build fields, call authFilesApi.patchFields, then only after patch/fallback checks isFreePlanMetadata and calls setStatus."
      - "AuthFilesPage.probeCredentials lines 1698-1714 routes all/selected batch probe successful quota targets through persistProbeQuotaMetadata -> persistQuotaMetadataForTargets -> persistQuotaMetadataForFile."
    falsification_test: "If free-plan results could reach a different persistence implementation that bypasses persistQuotaMetadataForFile, changing helper order would not affect that path; static trace shows card refresh, quota page refresh/load, and AuthFilesPage batch probe all import/call the helper."
    fix_rationale: "Handling free-plan metadata before patchFields removes the known unsupported PATCH body for free-plan results, persists the same metadata through the backend-compatible JSON save path, and still disables via the supported /auth-files/status endpoint; because batch probe shares the helper, it inherits the workflow."
    blind_spots: "No live backend is available locally, so Network confirmation still needs the user's environment; non-free quota metadata remains PATCH-first to preserve the original requested endpoint for compatible backends."

- hypothesis: "Free-plan detection now uses a shared global helper, and all shared quota persistence paths call setStatus for free-plan variants after metadata persistence."
- test: "User rebuilds/reruns the management UI, opens /management.html#/auth-files, clicks an auth-file card's quota refresh button for a free-plan file, and checks Network plus persisted auth-file state."
- expecting: "The flow sends the quota metadata persistence attempt/fallback and then PATCH /v0/management/auth-files/status with disabled true for plan_type values classified by isFreePlanType."
- next_action: "Wait for user to verify the same free-plan card refresh workflow and report 'confirmed fixed' or provide Network/HAR evidence if PATCH /auth-files/status is still missing."

- hypothesis: "Free-plan quota results now disable the auth file through the supported /auth-files/status mutation after quota metadata persistence."
- test: "User rebuilds/reruns the management UI, opens /management.html#/auth-files, clicks an auth-file card's quota refresh button for a free-plan file, then checks Network and auth-file state."
- expecting: "The quota flow still performs the metadata persistence attempt/fallback, and free-plan results additionally send PATCH /v0/management/auth-files/status with disabled: true; the auth file becomes disabled after refresh/reload."
- next_action: "Wait for user to verify the free-plan card refresh workflow and report 'confirmed fixed' or provide fresh Network/HAR evidence if disabled is not updated."
- reasoning_checkpoint:
    hypothesis: "The remaining actionable issue is not missing quota PATCH emission; it is that free-plan quota results should disable the auth file through the status endpoint because /auth-files/fields does not support quota metadata and likely does not support disabled."
    confirming_evidence:
      - "User reports the exact workflow is now fixed but still observes HTTP 400 no fields to update from /auth-files/fields."
      - "authFilesApi.setStatus exists and PATCHes /auth-files/status with { name, disabled }, and all existing disabled toggles use that helper."
      - "The shared quota persistence helper can read metadata.plan_type after successful quota fetches for all three repaired quota flows."
      - "Previous backend evidence for PatchAuthFileFields listed editable fields but did not include quota metadata or disabled."
    falsification_test: "If the backend's /auth-files/fields endpoint actually supports disabled and /auth-files/status is unavailable in the user's backend, then using setStatus would be wrong; local API wrappers and existing UI status toggle flows indicate /auth-files/status is the supported contract."
    fix_rationale: "Calling setStatus(file.name, true) when normalized plan_type is free addresses the user's requested durable disabled update through the endpoint already designed for disabled state, without broadening /auth-files/fields with unsupported fields or auto-enabling paid plans."
    blind_spots: "This cannot remove the existing /auth-files/fields 400 network entry unless the helper skips the quota patch entirely for free plans; the chosen fix preserves metadata fallback behavior and adds the requested disabled persistence. End-to-end backend verification is still required."
- reasoning_checkpoint:
    hypothesis: "AuthFilesPage card 'Click here to refresh quota' does not PATCH because AuthFileQuotaSection has a separate refreshQuotaForFile implementation that calls config.fetchQuota and updateQuotaState but never invokes persistQuotaMetadataForFile."
    confirming_evidence:
      - "User clarified the workflow is /management.html#/auth-files and auth file card 'Click here to refresh quota', not the quota page/card route fixed earlier."
      - "AuthFileCard renders AuthFileQuotaSection for selected quota-managed auth-file cards."
      - "AuthFileQuotaSection lines 86-122 fetch quota and update quota state/notification only; no authFilesApi.patchFields, saveJsonObject, or persistQuotaMetadataForFile call is present."
      - "The same component renders the idle button at lines 141-149 with onClick refreshQuotaForFile and text from ${config.i18nPrefix}.idle, matching 'Click here to refresh quota'."
    falsification_test: "If AuthFileQuotaSection.refreshQuotaForFile already reached persistQuotaMetadataForFile or the clarified click actually invoked AuthFilesPage.probeCredentials/QuotaSection, this hypothesis would be false; static component trace shows it is a distinct unpersisted handler."
    fix_rationale: "Calling the shared patch-first persistence helper in AuthFileQuotaSection after a successful quota state is built makes the exact card refresh path use the same PATCH/fallback mechanism as the other quota flows."
    blind_spots: "Local validation can prove the source path compiles and statically reaches PATCH, but browser/network end-to-end confirmation still requires the user's backend workflow."
- reasoning_checkpoint:
    hypothesis: "No PATCH is sent in the user's workflow because quota API calls from QuotaPage/QuotaSection update only client-side quota state; the patch-first persistence code is scoped to AuthFilesPage.probeCredentials and is never called by QuotaSection/useQuotaLoader."
    confirming_evidence:
      - "AuthFilesPage line 1841 calls persistProbeQuotaMetadata only inside probeCredentials after auth-file credential probes."
      - "QuotaPage renders QuotaSection for every quota provider; QuotaSection.refreshQuotaForFile and useQuotaLoader.loadQuota call config.fetchQuota then setQuota, with no authFilesApi.patchFields call."
      - "User's human verification says 'no patch request send' after previous fix, matching a code path that performs quota API calls but never reaches AuthFilesPage persistence."
    falsification_test: "If QuotaSection/useQuotaLoader already called authFilesApi.patchFields after successful fetchQuota, or the user verified they clicked AuthFilesPage's credential probe button on a fresh build, this hypothesis would be false."
    fix_rationale: "Move quota metadata persistence into a shared helper and invoke it from both AuthFilesPage credential probes and QuotaSection quota refresh/load paths, so every successful quota API call has the same PATCH-first persistence behavior."
    blind_spots: "Without a live backend/browser HAR, local verification can prove the source path emits patchFields on successful quota results and compiles, but cannot prove the user's exact click path until they retest."
- reasoning_checkpoint:
    hypothesis: "PATCH /auth-files/fields reaches the backend, but the current backend ignores quota metadata keys because its request struct lacks probe_quota/plan_type/tier_id/tier_label/credit_balance fields; changed remains false, producing 400 'no fields to update'."
    confirming_evidence:
      - "localhost.har shows PATCH /v0/management/auth-files/fields is emitted with probe_quota and plan_type, and the backend responds 400 {\"error\":\"no fields to update\"}."
      - "Public backend handler code for PatchAuthFileFields binds only prefix, proxy_url, base_url, headers, priority, note, and billing_class; unknown quota keys are discarded by JSON binding and do not set changed=true."
      - "The existing knowledge-base-confirmed persistence mechanism wrote probe_quota and plan metadata directly into auth-file JSON via downloadJsonObject/saveJsonObject and was verified end-to-end."
    falsification_test: "If the backend handler accepted probe_quota/plan_type as writable fields or the HAR showed a different error/status, this would be false; the HAR and handler code show the exact ignore/no-fields path."
    fix_rationale: "The frontend cannot make the current backend fields endpoint persist unsupported keys. Keeping PATCH first preserves the desired request for compatible backends, while using direct JSON save only for the exact unsupported-field response restores durable persistence on the observed backend without masking other PATCH failures."
    blind_spots: "This repo does not contain the user's exact backend binary; validation can prove frontend behavior and compile correctness, but end-to-end persistence still needs the user's backend after the compatibility fix."
- reasoning_checkpoint:
    hypothesis: "Quota probe persistence does not PATCH because persistProbeQuotaMetadata downloads the auth JSON, merges probe_quota/top-level quota metadata locally, then calls saveJsonObject/upload; the only PATCH helper authFilesApi.patchFields is not used by this path."
    confirming_evidence:
      - "src/pages/AuthFilesPage.tsx:716-723 calls authFilesApi.downloadJsonObject(file.name), applyPersistentProbeQuotaMetadata(...), and authFilesApi.saveJsonObject(file.name, nextAuthFileJson)."
      - "src/services/api/authFiles.ts:495-496 defines authFilesApi.patchFields as apiClient.patch('/auth-files/fields', { name, ...fields }), but code search shows the quota persistence path does not call it."
      - "Knowledge base entry probe-selected-did-not-update documents the previous persistence fix intentionally used downloadJsonObject/saveJsonObject, matching the observed absence of PATCH /management/auth-files/fields."
    falsification_test: "If persistProbeQuotaMetadata already invoked authFilesApi.patchFields on successful quota targets, or if saveJsonObject internally used PATCH /auth-files/fields, this hypothesis would be false; static inspection shows saveJsonObject uploads a File via POST /auth-files instead."
    fix_rationale: "Sending the exact detected metadata fields through authFilesApi.patchFields addresses the transport mismatch directly: the same successful quota detection now persists via the backend fields endpoint the user expects, without changing quota fetching or UI readback behavior."
    blind_spots: "Backend acceptance of probe_quota/plan_type/tier_id/tier_label/credit_balance through /auth-files/fields cannot be proven without a running Management API backend; local verification can only prove the frontend emits the PATCH call and compiles."
- tdd_checkpoint: ""

## Evidence

- timestamp: 2026-05-21T05:55:00Z
  checked: "Latest human verification response against current helper order and batch probe call path"
  found: "persistQuotaMetadataForFile builds fields, always awaits authFilesApi.patchFields(file.name, fields), catches only 400/no fields to update for JSON fallback, and only afterward checks isFreePlanMetadata(metadata) to call authFilesApi.setStatus(file.name, true). AuthFilesPage batch/selected/all probe flows call refreshQuotaCacheForProbeResults, then persistProbeQuotaMetadata, which delegates to persistQuotaMetadataForTargets and the same persistQuotaMetadataForFile helper."
  implication: "The user's observed free-plan PATCH body is explained by current helper ordering, not a missed single-card path. Batch probe already reaches the shared workflow, so moving free-plan handling before patchFields in the shared helper should fix both single-card and batch probe behavior."

- timestamp: 2026-05-21T06:05:00Z
  checked: "Minimal helper-order fix"
  found: "Changed persistQuotaMetadataForFile so it computes isFreePlanMetadata immediately after building fields; free-plan metadata now calls saveProbeQuotaMetadataToAuthFile, then authFilesApi.setStatus(file.name, true) when not already disabled, then returns before authFilesApi.patchFields. Non-free metadata keeps the existing PATCH-first/fallback behavior."
  implication: "The free-plan payload from the user's checkpoint should no longer be sent to PATCH /auth-files/fields, and batch probe should inherit the same behavior because it uses persistQuotaMetadataForTargets. Validation is running next."

- timestamp: 2026-05-21T06:20:00Z
  checked: "Validation after free-plan no-fields-PATCH fix"
  found: "Ran pnpm exec prettier --write src/components/quota/persistQuotaMetadata.ts, pnpm run type-check, pnpm run lint, and pnpm run build successfully. Build again printed two Windows path warning lines before Vite output but completed. Static inspection confirms free-plan branch returns before authFilesApi.patchFields, and grep confirms AuthFilesPage batch probe uses persistQuotaMetadataForTargets while AuthFileQuotaSection, QuotaSection, and useQuotaLoader call persistQuotaMetadataForFile."
  implication: "Source now implements the requested shared workflow for card refresh and batch probe. End-to-end Network confirmation remains required in the user's backend/browser environment."

- timestamp: 2026-05-21T05:10:00Z
  checked: "Free-plan helper coverage after human verification question"
  found: "persistQuotaMetadataForFile is now imported/called by AuthFileQuotaSection, QuotaSection, useQuotaLoader, and AuthFilesPage probe persistence, so quota persistence is centralized. However the free-plan predicate is local to persistQuotaMetadata.ts and only checks normalizePlanType(metadata.plan_type) === 'free', while AuthFilesPage already maintains a wider free-plan set including 'plan_free', 'free-tier', and 'free_tier'."
  implication: "The status-disable logic should use a shared/free-plan utility instead of a one-off equality check, otherwise provider variants such as Claude's 'plan_free' can be classified as free in filters but not trigger setStatus."

- timestamp: 2026-05-21T05:35:00Z
  checked: "Shared free-plan helper fix and validation"
  found: "Added isFreePlanType to src/utils/quota/parsers.ts with the shared free-plan variants ['free', 'plan_free', 'free-tier', 'free_tier']; persistQuotaMetadata.ts now uses that helper before authFilesApi.setStatus(file.name, true), and AuthFilesPage's plan filter uses the same helper. Ran pnpm exec prettier --write on touched files, pnpm run type-check, pnpm run lint, and pnpm run build successfully. Build again printed two Windows path warning lines before Vite output but completed successfully."
  implication: "The free-plan disable condition is now centralized and consistent across plan filtering and quota metadata persistence. End-to-end backend/browser verification is still required."

- timestamp: 2026-05-21T00:00:00Z
  checked: "Required debug session and common bug patterns references"
  found: "Symptoms indicate an API contract/state persistence bug: quota/auth-files flow does not emit PATCH /management/auth-files/fields. Common pattern candidates are Data Shape/API Contract, State Management dual source of truth, and Error Handling swallowed/gated persistence."
  implication: "Investigate where detected quota/auth-file fields are stored versus where PATCH persistence is implemented."

- timestamp: 2026-05-21T00:05:00Z
  checked: "Code search for auth-files/fields, quota/probe, and PATCH callers"
  found: "authFilesApi.patchFields exists in src/services/api/authFiles.ts and is used by priority/prefix-proxy flows, while quota probe/persistence logic is concentrated in src/pages/AuthFilesPage.tsx around build/apply/persistPersistentProbeQuotaMetadata."
  implication: "The likely divergence is inside AuthFilesPage quota metadata persistence rather than missing API client support."

- timestamp: 2026-05-21T00:15:00Z
  checked: "Static trace of quota persistence and API helper implementations"
  found: "persistProbeQuotaMetadata downloads auth JSON, applies probe_quota/top-level metadata, and calls authFilesApi.saveJsonObject; saveJsonObject serializes to a File and uploads via POST /auth-files. authFilesApi.patchFields is a separate PATCH /auth-files/fields helper unused by this path."
  implication: "Root cause confirmed: the quota persistence transport is the wrong API path/method for the expected PATCH /management/auth-files/fields request."

- timestamp: 2026-05-21T00:25:00Z
  checked: "Minimal fix implementation"
  found: "Changed persistProbeQuotaMetadata to call authFilesApi.patchFields(file.name, buildPersistentProbeQuotaFields(metadata)); added an index signature to AuthFileFieldsPatch so probe_quota and quota plan/tier fields can be sent through the existing fields endpoint."
  implication: "Quota probe persistence now uses the same API client path that emits PATCH /auth-files/fields. Validation remains required."

- timestamp: 2026-05-21T00:40:00Z
  checked: "Local validation"
  found: "Ran pnpm exec prettier --write on touched files, pnpm run type-check, pnpm run lint, and pnpm run build successfully. Static grep confirms persistProbeQuotaMetadata calls authFilesApi.patchFields(file.name, buildPersistentProbeQuotaFields(metadata)); authFilesApi.patchFields emits apiClient.patch('/auth-files/fields', { name, ...fields })."
  implication: "Frontend code now compiles/builds and the quota persistence code path will emit PATCH /auth-files/fields. End-to-end backend verification remains outside local environment."

- timestamp: 2026-05-21T01:00:00Z
  checked: "User-provided localhost.har after probe action"
  found: "HAR contains GET /v0/management/auth-files, two POST /v0/management/api-call quota probes, then PATCH /v0/management/auth-files/fields with body {name, probe_quota, plan_type/tier_id/tier_label/credit_balance...}; backend returns HTTP 400 {\"error\":\"no fields to update\"}, followed by GET /auth-files."
  implication: "Previous fix solved the missing PATCH emission but exposed a backend API contract mismatch: the fields endpoint receives the request but treats the quota metadata keys as non-updatable/ignored fields."

- timestamp: 2026-05-21T01:10:00Z
  checked: "Backend contract evidence from public CLIProxyAPIPlus handler and local patchFields callers"
  found: "PatchAuthFileFields binds Name, Prefix, ProxyURL, BaseURL, Headers, Priority, Note, and BillingClass only; unknown probe_quota/plan_type/tier_id/tier_label/credit_balance request properties are discarded, leaving changed=false and returning 'no fields to update'. Local callers use patchFields for priority/prefix/proxy/header-style editable fields."
  implication: "Root cause confirmed: quota metadata is not a supported /auth-files/fields patch payload on the current backend. Frontend-only persistence must use the auth JSON save path for this metadata unless/until the backend adds quota fields support."

- timestamp: 2026-05-21T01:20:00Z
  checked: "Compatibility fix implementation"
  found: "persistProbeQuotaMetadata now builds the quota metadata payload once, attempts authFilesApi.patchFields first, and on only HTTP 400 'no fields to update' downloads the auth JSON and saves the same probe_quota/plan metadata fields through saveJsonObject. AuthFileFieldsPatch no longer has an arbitrary string index signature; it explicitly lists known editable fields plus quota metadata keys used by this path."
  implication: "The exact HAR failure mode should no longer prevent persistence, while unrelated PATCH failures still surface as probe persistence failures. Validation is required."

- timestamp: 2026-05-21T01:30:00Z
  checked: "Validation after HAR-driven compatibility fix"
  found: "Ran pnpm exec prettier --write src/pages/AuthFilesPage.tsx src/services/api/authFiles.ts, pnpm run type-check, pnpm run lint, and pnpm run build successfully. Static grep confirms persistProbeQuotaMetadata calls patchFields first, detects isUnsupportedProbeQuotaPatchError, then calls saveProbeQuotaMetadataToAuthFile only for that specific response."
  implication: "Frontend compiles/builds and implements the intended compatibility behavior. End-to-end verification with the user's backend remains required."

- timestamp: 2026-05-21T02:00:00Z
  checked: "Human verification checkpoint response"
  found: "User reports: 'no patch request send'."
  implication: "The prior compatibility fix did not reproduce in the user's workflow. Re-open investigation: either the tested app is stale, the probe path does not invoke persistence for this action, or a guard/early return prevents authFilesApi.patchFields from executing."

- timestamp: 2026-05-21T02:12:00Z
  checked: "Current quota persistence call paths"
  found: "AuthFilesPage.persistProbeQuotaMetadata contains patch-first logic, but it is only called from AuthFilesPage.probeCredentials after refreshQuotaCacheForProbeResults. QuotaPage renders QuotaSection, whose useQuotaLoader and refreshQuotaForFile call config.fetchQuota and set Zustand quota state only; neither path calls authFilesApi.patchFields or saveJsonObject."
  implication: "Root cause refined: the previous fix covered the auth-files credential probe flow, but not the quota page/card refresh flow that also performs quota API calls. If the user tested quota refresh there, no PATCH can be sent by design."

- timestamp: 2026-05-21T02:45:00Z
  checked: "Quota-page persistence fix and local validation"
  found: "Extracted patch-first quota metadata persistence into src/components/quota/persistQuotaMetadata.ts. AuthFilesPage now reuses the shared helper. QuotaSection.refreshQuotaForFile and useQuotaLoader.loadQuota now call persistQuotaMetadataForFile after successful config.fetchQuota/buildSuccessState. Ran prettier, pnpm run type-check, pnpm run lint, and pnpm run build successfully. Static grep confirms authFilesApi.patchFields(file.name, fields) is now reachable from both quota page/card refresh and auth-files probe flows."
  implication: "The newly reported 'no patch request send' path is addressed in source and validates locally. Human verification is still required with the real backend/browser workflow."

- timestamp: 2026-05-21T03:15:00Z
  checked: "Clarified human workflow and AuthFilesPage auth-file-card quota refresh path"
  found: "User clarified the failing action is /management.html#/auth-files on an auth file card's 'Click here to refresh quota' button. AuthFileCard renders AuthFileQuotaSection for that card. AuthFileQuotaSection has its own refreshQuotaForFile handler that calls config.fetchQuota, updateQuotaState, and showNotification, but does not call persistQuotaMetadataForFile or authFilesApi.patchFields."
  implication: "Root cause refined again: the previous fixes covered AuthFilesPage credential probes, QuotaPage/QuotaSection, and useQuotaLoader initial load, but missed the auth-file card embedded quota section refresh handler."

- timestamp: 2026-05-21T03:30:00Z
  checked: "Auth-file-card quota refresh fix and validation"
  found: "Updated src/features/authFiles/components/AuthFileQuotaSection.tsx so refreshQuotaForFile builds quotaState, awaits persistQuotaMetadataForFile(file, config, quotaState, Date.now()), then updates the quota state. Ran pnpm exec prettier --write on the file, pnpm run type-check, pnpm run lint, and pnpm run build successfully. Static grep confirms persistQuotaMetadataForFile is imported and called in AuthFileQuotaSection."
  implication: "The exact clarified auth-file card 'Click here to refresh quota' path now reaches the shared PATCH-first quota persistence helper. End-to-end confirmation still requires the user's running backend/browser workflow."

- timestamp: 2026-05-21T04:10:00Z
  checked: "Human verification response and disabled-field contract"
  found: "User reports the clarified workflow is fixed but Network/backend still shows HTTP 400 {\"error\":\"no fields to update\"}; they suggest updating disabled when plan_type is free. Local authFilesApi has a dedicated setStatus(name, disabled) helper that PATCHes /auth-files/status, while patchFields only targets /auth-files/fields. Existing UI status toggles use setStatus for disabled changes. Prior backend evidence showed /auth-files/fields ignores quota keys; disabled was not among the observed fields handler keys."
  implication: "The safe supported way to disable a free-plan auth file is authFilesApi.setStatus(file.name, true), not relying on /auth-files/fields to accept disabled. The fix should be conditional on normalized plan_type === free and should not auto-enable non-free files."

- timestamp: 2026-05-21T04:30:00Z
  checked: "Free-plan disable fix and validation"
  found: "Updated src/components/quota/persistQuotaMetadata.ts to import normalizePlanType, detect metadata.plan_type normalized to 'free', and call authFilesApi.setStatus(file.name, true) after quota metadata patch/fallback when the file is not already disabled. Ran pnpm exec prettier --write src/components/quota/persistQuotaMetadata.ts, pnpm run type-check, pnpm run lint, and pnpm run build successfully. Build printed two Windows 'system cannot find the path specified' messages before Vite output, but completed successfully."
  implication: "All successful quota refresh/probe paths that share persistQuotaMetadataForFile now persist the requested disabled state for free-plan auth files through the existing status endpoint. End-to-end verification with the user's backend/browser remains required."

## Eliminated

## Resolution

- root_cause: "There were multiple related quota persistence issues. First, several quota API-call flows did not reach the shared persistence code. After those paths were repaired, the current backend still returns HTTP 400 'no fields to update' for quota metadata because /auth-files/fields does not support probe_quota/plan_type/tier_id/tier_label/credit_balance. The latest remaining issue was helper ordering: free-plan metadata still tried the unsupported /auth-files/fields PATCH before the helper disabled the file via /auth-files/status. Batch probe is not a separate missed implementation; it delegates through persistQuotaMetadataForTargets to the same helper, so the shared helper ordering controls both single-card and batch behavior."
- fix: "Extracted quota metadata persistence into src/components/quota/persistQuotaMetadata.ts. AuthFilesPage batch/all/selected probes, QuotaSection/useQuotaLoader, and AuthFileQuotaSection all invoke the shared helper after successful quota results. Added a shared isFreePlanType helper in src/utils/quota/parsers.ts and use it from both persistQuotaMetadata.ts and AuthFilesPage. The shared helper now handles free-plan metadata before patchFields: it saves probe_quota plus top-level plan_type/tier_id/tier_label/credit_balance through the auth-file JSON save/upload path, calls authFilesApi.setStatus(file.name, true) through PATCH /auth-files/status when the file is not already disabled, and returns before PATCH /auth-files/fields. Non-free metadata keeps the prior PATCH-first/fallback behavior for compatible backends."
- verification: "Self-verified with prettier on src/components/quota/persistQuotaMetadata.ts; pnpm run type-check; pnpm run lint; and pnpm run build. Build completed successfully despite two Windows path warning lines before Vite output. Static inspection confirms the free-plan branch returns before authFilesApi.patchFields and batch probe uses persistQuotaMetadataForTargets -> persistQuotaMetadataForFile. User confirmed fixed in the real Management API/browser workflow on 2026-05-21."
- files_changed: ["src/utils/quota/parsers.ts", "src/components/quota/persistQuotaMetadata.ts", "src/components/quota/useQuotaLoader.ts", "src/components/quota/QuotaSection.tsx", "src/features/authFiles/components/AuthFileQuotaSection.tsx", "src/pages/AuthFilesPage.tsx", "src/services/api/authFiles.ts"]
