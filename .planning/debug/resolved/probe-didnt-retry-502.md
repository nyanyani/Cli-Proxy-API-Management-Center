---
status: resolved
trigger: |
  probe didn't retry the response HTTP/1.1 502 Bad Gateway
  Access-Control-Allow-Headers: *
  Access-Control-Allow-Methods: GET, POST, PUT, PATCH, DELETE, OPTIONS
  Access-Control-Allow-Origin: *
  Content-Type: application/json; charset=utf-8
  X-Cpa-Build-Date: 2026-05-04T19:08:21Z
  X-Cpa-Commit: da6c599e
  X-Cpa-Version: 6.10.8
  Date: Wed, 20 May 2026 09:31:34 GMT
  Content-Length: 26
  {"error":"request failed"}
created: 2026-05-20
updated: 2026-05-20T00:30:00Z
---

# Debug Session: probe-didnt-retry-502

## Symptoms

- expected_behavior: A credential probe should retry transient HTTP 502 Bad Gateway responses before surfacing failure.
- actual_behavior: The probe surfaced a 502 Bad Gateway response as a final request failure without retrying.
- error_messages: |
    HTTP/1.1 502 Bad Gateway
    Access-Control-Allow-Headers: *
    Access-Control-Allow-Methods: GET, POST, PUT, PATCH, DELETE, OPTIONS
    Access-Control-Allow-Origin: *
    Content-Type: application/json; charset=utf-8
    X-Cpa-Build-Date: 2026-05-04T19:08:21Z
    X-Cpa-Commit: da6c599e
    X-Cpa-Version: 6.10.8
    Date: Wed, 20 May 2026 09:31:34 GMT
    Content-Length: 26
    {"error":"request failed"}
- timeline: Not provided.
- reproduction: Trigger the credential probe path and observe that the HTTP 502 response is not retried.

## Current Focus

- hypothesis: Confirmed: the probe retry path is working; the observed 502 is the final response after exhausting the configured three attempts.
- test: User counted browser/backend probe requests for the failing credential.
- expecting: Three attempts confirms retry execution; the remaining 502 means every attempt received a transient gateway failure, not that the UI skipped retries.
- next_action: Archive session as resolved with no source-code fix required.
- reasoning_checkpoint:
- tdd_checkpoint:

## Evidence

- timestamp: 2026-05-20T00:00:00Z
  checked: common bug patterns
  found: Symptoms map primarily to Error Handling/API Contract because an HTTP 502 error is surfaced instead of retried; Async/Timing is secondary if retry attempts are scheduled incorrectly.
  implication: First hypotheses should focus on status classification, retry wrapper coverage, and probe API error normalization.

- timestamp: 2026-05-20T00:05:00Z
  checked: knowledge base and AuthFilesPage retry path
  found: Knowledge base has a prior matching session "probe-all-credentials-retry" with the same 502 gateway retry symptom. Current AuthFilesPage defines PROBE_TRANSIENT_STATUS_CODES = {502,503,504}, requestProbeWithRetry, and probeCredentials calls requestProbeWithRetry at line 1512.
  implication: The known fix appears to be present in the current working tree; next test is whether it is uncommitted/currently valid, and whether the reported failure came from a build lacking this source.

- timestamp: 2026-05-20T00:05:00Z
  checked: apiClient error normalization
  found: Axios response failures are normalized to ApiError with status = error.response?.status, so an HTTP 502 from the Management API is visible to getProbeErrorStatus and qualifies for retry.
  implication: Current source should retry both thrown HTTP 502s and api-call result statusCode 502s; if the UI still does not retry, the running artifact may not include this source or all attempts are failing.

- timestamp: 2026-05-20T00:10:00Z
  checked: git diff and build artifact clues
  found: AuthFilesPage already had requestProbeWithRetry and 502/503/504 retry logic in the baseline diff; current uncommitted changes mainly add abort/stop handling around the existing retry path. No dist artifact exists in the checkout. The reported response header is from backend/proxy version 6.10.8 built on 2026-05-04, not direct evidence of which Management UI source/build is running.
  implication: Missing current-source retry logic is falsified; next verification should prove the checkout builds and then require real-environment verification or network evidence showing fewer than three /api-call attempts.

- timestamp: 2026-05-20T00:15:00Z
  checked: pnpm validation commands
  found: pnpm run type-check passed; pnpm run lint passed; pnpm run build passed and produced a single-file Vite production build.
  implication: Current source is internally valid and includes retry classification for 502/503/504; the remaining unknown is runtime evidence from the real Management API/browser session.

- timestamp: 2026-05-20T00:30:00Z
  checked: human network verification
  found: User reported the failing probe made 3 attempts and then returned 502.
  implication: The original claim that the probe did not retry is falsified for the current runtime; the final 502 is after retry exhaustion because all configured attempts failed.

## Eliminated

- hypothesis: Current AuthFilesPage lacks retry handling for HTTP 502 probe failures.
  evidence: Current source and baseline diff both include PROBE_TRANSIENT_STATUS_CODES with 502 and requestProbeWithRetry, and probeCredentials calls requestProbeWithRetry instead of apiCallApi.request directly.
  timestamp: 2026-05-20T00:10:00Z

## Resolution

- root_cause: The UI did not skip retrying. Current AuthFilesPage retries probe HTTP/api-call 502/503/504 responses up to PROBE_MAX_ATTEMPTS=3; the real failing workflow made all three attempts and then surfaced the final 502 after retry exhaustion.
- fix: No source-code change required for the reported "didn't retry" symptom. Existing implementation already retries thrown ApiError.status 502 and api-call result statusCode 502 up to PROBE_MAX_ATTEMPTS=3.
- verification: Static verification passed with pnpm run type-check, pnpm run lint, and pnpm run build; human network verification reported 3 attempts followed by 502, confirming retry behavior in the real workflow.
- files_changed:
  - .planning/debug/resolved/probe-didnt-retry-502.md
