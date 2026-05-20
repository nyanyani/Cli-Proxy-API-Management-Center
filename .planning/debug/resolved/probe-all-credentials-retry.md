---
status: resolved
trigger: "Probe all credentials should retry Failed to load resource: the server responded with a status of 502 (Bad Gateway)"
created: 2026-05-20
updated: 2026-05-20T00:45:00Z
---

# Debug Session: probe-all-credentials-retry

## Symptoms

- expected_behavior: Probe all credentials should retry when a credential probe request fails with a transient server or gateway error.
- actual_behavior: Probe all credentials reports a failed resource instead of successfully retrying/recovering from a 502 Bad Gateway response.
- error_messages: "Failed to load resource: the server responded with a status of 502 (Bad Gateway)"
- timeline: Not provided.
- reproduction: Trigger the Probe all credentials action and observe a 502 Bad Gateway resource failure.

## Current Focus

- hypothesis: Probe all credentials calls apiCall directly and treats a single transient 502 as final failure because no retry wrapper is present on that path
- test: human verification against a real Management API/backend because this UI repository cannot fully reproduce server-side 502 behavior alone
- expecting: triggering Probe all credentials during a transient 502 will retry before reporting failure, and transient recovery within 3 attempts will produce a success state
- next_action: ask user to run Probe all credentials in their real workflow and report "confirmed fixed" or the remaining failure details
- reasoning_checkpoint:
    hypothesis: "Probe all credentials fails on a transient 502 because probeCredentials awaits apiCallApi.request once per target; apiClient rejects HTTP 502 and the catch branch immediately records an error, while api-call response statusCode 502 is also marked final without retry."
    confirming_evidence:
      - "AuthFilesPage.tsx lines 1458-1520 run each ProbeTarget once, call apiCallApi.request(request, { signal }), and immediately update probeState to error in either non-2xx result or catch."
      - "apiCall.ts lines 124-140 performs a single apiClient.post('/api-call', payload, config) with no retry loop."
      - "client.ts lines 124-127 rejects axios response errors through handleError; handleError preserves error.response?.status, so an HTTP 502 enters the probe catch path as final failure."
    falsification_test: "If AuthFilesPage or apiCallApi already had retry logic for 502/503/504 on this path, or if 502 was only a deterministic credential auth failure, this hypothesis would be wrong; code inspection shows neither retry exists and 502 is a gateway/server status, not auth."
    fix_rationale: "A scoped retry wrapper around the probe api-call addresses the root cause by retrying only transient probe failures before the existing success/error state decision runs."
    blind_spots: "The backend cannot be run here, so runtime verification will be limited to static tracing plus type/lint/build checks; human verification is needed against a real Management API."
- tdd_checkpoint:

## Evidence

- timestamp: 2026-05-20T00:00:00Z
  checked: debug session resume state
  found: Symptoms are prefilled; current failure is Probe all credentials surfacing a 502 Bad Gateway resource failure instead of retrying/recovering.
  implication: Investigation can start from the request path and retry/error-handling logic without asking for more symptom details.
- timestamp: 2026-05-20T00:05:00Z
  checked: knowledge base and initial code search
  found: No .planning/debug/knowledge-base.md exists. Code search located Probe all credentials implementation in src/pages/AuthFilesPage.tsx and the /api-call wrapper in src/services/api/apiCall.ts.
  implication: There is no prior known-pattern shortcut; continue by tracing the local probe request path.
- timestamp: 2026-05-20T00:12:00Z
  checked: AuthFilesPage probeCredentials and apiCall/apiClient request stack
  found: probeCredentials calls apiCallApi.request exactly once per target, non-2xx api-call results are marked error immediately, and thrown ApiError responses are caught and marked error immediately. apiCallApi.request is a single apiClient.post('/api-call') with no retry.
  implication: The root cause is confirmed as missing transient retry handling in the credential probe path.
- timestamp: 2026-05-20T00:20:00Z
  checked: implemented probe retry fix
  found: Added a scoped requestProbeWithRetry helper in AuthFilesPage.tsx. Probe attempts now retry up to 3 total attempts for transient 502/503/504 statuses returned either as api-call statusCode or as thrown ApiError.status, while aborts remain immediate skips.
  implication: The code path now addresses the confirmed missing retry behavior without changing unrelated api-call consumers.
- timestamp: 2026-05-20T00:30:00Z
  checked: static verification
  found: Ran pnpm exec prettier --write src/pages/AuthFilesPage.tsx, pnpm run type-check, pnpm run lint, and pnpm run build successfully. Vite build completed and produced dist/index.html; build emitted two existing localized Windows path warnings but exited successfully.
  implication: The TypeScript, lint, and production build checks accept the fix; real backend verification remains required for the original transient 502 workflow.

## Eliminated

## Resolution

- root_cause: Probe all credentials sends each credential probe through a single api-call attempt. Transient gateway/server failures (HTTP 502/503/504 from the management endpoint, or 502/503/504 returned as api-call statusCode) are treated as final errors immediately because no retry wrapper exists on the probe path.
- fix: Added scoped credential-probe retry handling in src/pages/AuthFilesPage.tsx and changed probeCredentials to call requestProbeWithRetry instead of apiCallApi.request directly.
- verification: Static checks passed: prettier, type-check, lint, and build. User confirmed the original Probe all credentials transient 502 workflow is fixed in the real Management API environment.
- files_changed: [src/pages/AuthFilesPage.tsx]
