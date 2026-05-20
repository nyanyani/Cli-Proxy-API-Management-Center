---
status: investigating
trigger: "i selected the No detected plan and probe the selected, but when the process finished, their still auth files left"
created: 2026-05-20
updated: 2026-05-20T09:15:00Z
---

# Debug Session: i-selected-the-no-detected-pla

## Symptoms

DATA_START
- Expected behavior: After selecting the "No detected plan" filter and running "probe selected", the process should update detected plans for the selected auth files so successfully probed files no longer remain in the "No detected plan" list unless their plan is truly still unknown/no detected plan.
- Actual behavior: When the probe process finishes, auth files are still left under the "No detected plan" filter/list.
- Error messages: Probe cache summary reported by user: "Probe cache: 2961 checked · 572 OK · 910 errors · 0 auth errors".
- Timeline: Not provided.
- Reproduction: Select the "No detected plan" plan filter, select visible auth files, run probe selected, wait for process completion, observe remaining auth files still visible under "No detected plan".
- Diagnose only: false
DATA_END

## Current Focus

- hypothesis: Auth file list/filter state is not being refreshed or re-filtered after probe selected updates detected plan metadata.
- test: Read auth-files feature state, filtering, and probe-selected implementations to trace where detected plan is stored and how the No detected plan filter derives its list.
- expecting: If true, the probe completion path updates cache/probe state but not the auth file record/plan index used by the active plan filter, or fails to invalidate/refetch after probing.
- next_action: read knowledge base and relevant auth file feature/service/store files that mention plan filtering or probing
- reasoning_checkpoint:
- tdd_checkpoint:

## Evidence

- timestamp: 2026-05-20T09:15:00Z
  checked: initial repository search for No detected plan/probe selected strings
  found: UI copy for plan_filter_none and probe_summary exists in locale files; source grep did not directly find English text in feature logic.
  implication: Need to trace via locale keys and authFiles feature code rather than literal labels.

## Eliminated

## Resolution

- root_cause:
- fix:
- verification:
- files_changed:
