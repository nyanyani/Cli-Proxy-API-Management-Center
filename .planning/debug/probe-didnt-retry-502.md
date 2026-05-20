---
status: investigating
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
updated: 2026-05-20
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

- hypothesis:
- test:
- expecting:
- next_action: gather initial evidence
- reasoning_checkpoint:
- tdd_checkpoint:

## Evidence

## Eliminated

## Resolution

- root_cause:
- fix:
- verification:
- files_changed:
