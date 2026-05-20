---
status: investigating
trigger: "i selected the No detected plan and probe the selected, but when the process finished, their still auth files left"
created: 2026-05-20
updated: 2026-05-20T09:10:11Z
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
