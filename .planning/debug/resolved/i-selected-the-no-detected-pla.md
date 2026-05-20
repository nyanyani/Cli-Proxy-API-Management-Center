---
status: resolved
trigger: "i selected the No detected plan and probe the selected, but when the process finished, their still auth files left"
created: 2026-05-20
updated: 2026-05-20T10:25:00Z
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

- hypothesis: Codex quota parsing accepted direct usage payloads but not an API-call envelope object, so the user's {status_code, header, body: "{...plan_type...}"} shape left planType null.
- test: Ask user to verify the original No detected plan + probe selected workflow against the real backend data after adding nested envelope body unwrapping.
- expecting: Codex/OpenAI quota responses shaped as API-call envelopes with body.plan_type='free' are classified as Free instead of No detected plan; genuinely unknown/unsupported/failed files may remain.
- next_action: wait for user to rerun probe selected and report "confirmed fixed" or provide any remaining incorrectly listed response shape
- reasoning_checkpoint:
    hypothesis: "Codex/OpenAI auth files remain under No detected plan after successful probing because parseCodexUsagePayload returns an API-call envelope object directly instead of parsing its nested body JSON, so fetchCodexQuota never sees body.plan_type='free'."
    confirming_evidence:
      - "The human verification response is status_code=200 with a body string containing plan_type='free', not Gemini tier data."
      - "fetchCodexQuota derives planType from normalizePlanType(payload.plan_type ?? payload.planType)."
      - "parseCodexUsagePayload previously returned object payloads as-is and did not unwrap object.body, so an envelope object's plan_type is undefined."
    falsification_test: "If parseCodexUsagePayload receives the user's envelope and still cannot return a payload whose plan_type normalizes to 'free' after unwrapping body, this hypothesis is wrong."
    fix_rationale: "Unwrapping nested API-call envelope body strings in the Codex parser makes the existing quota success state carry planType='free', which the existing No detected plan classifier already recognizes."
    blind_spots: "Cannot directly run against the user's live backend/auth files here; if another remaining item has a different provider or response envelope, it may require a separate parser path."

## Evidence

- timestamp: 2026-05-20T09:15:00Z
  checked: initial repository search for No detected plan/probe selected strings
  found: UI copy for plan_filter_none and probe_summary exists in locale files; source grep did not directly find English text in feature logic.
  implication: Need to trace via locale keys and authFiles feature code rather than literal labels.
- timestamp: 2026-05-20T09:18:00Z
  checked: knowledge base entries for overlapping auth file/plan/probe bugs
  found: Prior resolved session has-plan-filter-return-the-wro changed planFilter to category-based filtering in AuthFilesPage.tsx.
  implication: Current bug is likely in the same plan category classifier path, not in locale/UI state plumbing.
- timestamp: 2026-05-20T09:21:00Z
  checked: AuthFilesPage plan filtering and probe selected flow
  found: planFilter='none' calls getPlanCategoryForFile(file, quotaState); resolvePlanTypeForFile reads quota planType/plan_type/plan plus auth-file plan fields. Probe selected refreshes quota cache for successful targets, then loadFiles().
  implication: The list does re-render from React state; a successful probe only changes the No detected plan filter if the quota success state exposes a field resolvePlanTypeForFile recognizes.
- timestamp: 2026-05-20T09:22:00Z
  checked: Gemini CLI quota config success state
  found: GEMINI_CLI_CONFIG buildSuccessState stores tierLabel and tierId, not planType/plan_type/plan. resolvePlanTypeForFile ignores both tierId and tierLabel.
  implication: Successfully probed Gemini CLI auth files with detected free/pro tier still remain classified as 'none'.
- timestamp: 2026-05-20T09:27:00Z
  checked: Gemini CLI quota type and supplementary refresh flow
  found: GeminiCliQuotaState defines tierId/tierLabel; supplementary Code Assist refresh later updates the same quota store entry with tierId, which should trigger AuthFilesPage re-render.
  implication: Minimal fix is to make resolvePlanTypeForFile treat quota tierId/tier_id as detected plan identifiers.
- timestamp: 2026-05-20T09:30:00Z
  checked: code change in AuthFilesPage.tsx
  found: Added quotaRecord.tierId and quotaRecord.tier_id to resolvePlanTypeForFile candidates immediately after quota plan fields.
  implication: Existing plan category logic will now classify Gemini CLI quota tier ids as detected plans.
- timestamp: 2026-05-20T09:32:00Z
  checked: pnpm run type-check
  found: TypeScript check passed with tsc --noEmit.
  implication: The targeted change is type-safe under the project's strict TypeScript configuration.
- timestamp: 2026-05-20T09:34:00Z
  checked: pnpm run build
  found: Production build completed successfully with Vite; console printed two localized "system cannot find path" messages before Vite build but exited successfully.
  implication: The fix does not break the production build, though the existing build script emits unrelated path warnings in this environment.
- timestamp: 2026-05-20T09:36:00Z
  checked: pnpm run lint
  found: ESLint completed successfully.
  implication: The code change passes the project's static lint checks.
- timestamp: 2026-05-20T09:38:00Z
  checked: git status and targeted diff
  found: Working tree contains many pre-existing modified files unrelated to this targeted fix; this session's code change is the two added plan candidates in src/pages/AuthFilesPage.tsx plus debug file updates.
  implication: Do not stage or commit until human verification, and stage only the intended file when archiving.
- timestamp: 2026-05-20T09:50:00Z
  checked: human verification response for prior Gemini tier hypothesis
  found: User reported the failing remaining item is not Gemini CLI tier data; the provided successful response is status_code=200 with a JSON string in body containing plan_type='free', rate_limit.allowed=false, and rate_limit_reached_type.type='rate_limit_reached'.
  implication: Prior fix was insufficient for this real data shape; investigate nested response body parsing/normalization for plan_type before attempting another fix.
- timestamp: 2026-05-20T10:02:00Z
  checked: parseCodexUsagePayload and fetchCodexQuota code path
  found: fetchCodexQuota depends on parseCodexUsagePayload(...). parseCodexUsagePayload JSON-parses top-level strings, but for object payloads it returns the object directly and does not unwrap a nested API-call envelope body field.
  implication: A payload shaped like the user's {status_code, header, body: "{...plan_type...}"} is treated as the usage payload itself; payload.plan_type is undefined, so Codex planType falls back to file metadata and can remain null.
- timestamp: 2026-05-20T10:07:00Z
  checked: code change in src/utils/quota/parsers.ts
  found: parseCodexUsagePayload now detects object payloads without plan_type/planType but with a body field, recursively parses body, and returns the nested payload when valid.
  implication: The user's envelope shape now exposes nested body.plan_type='free' to fetchCodexQuota and CODEX_CONFIG.buildSuccessState.
- timestamp: 2026-05-20T10:12:00Z
  checked: pnpm run type-check and pnpm run lint
  found: TypeScript and ESLint completed successfully.
  implication: The parser change is type-safe and lint-clean.
- timestamp: 2026-05-20T10:14:00Z
  checked: pnpm run build
  found: Production build completed successfully with Vite; the same existing localized path warnings appeared before Vite build but the command exited successfully.
  implication: The targeted parser fix does not break the production build.

## Eliminated

- hypothesis: Gemini CLI auth files remain under No detected plan solely because resolvePlanTypeForFile ignored quotaState.tierId/tier_id.
  evidence: Human verification supplied a non-Gemini response whose detected plan is in nested body.plan_type='free' yet still remained under No detected plan.
  timestamp: 2026-05-20T09:50:00Z

## Resolution

- root_cause: The No detected plan workflow had multiple missing plan-normalization paths. First, AuthFilesPage ignored Gemini CLI quota tier identifiers. The human verification then exposed the remaining Codex/OpenAI shape: a successful API-call envelope object with body as a JSON string containing plan_type='free'. parseCodexUsagePayload returned object payloads directly, so it treated the envelope as the usage payload and never read nested body.plan_type; fetchCodexQuota therefore produced planType null and the file stayed categorized as No detected plan.
- fix: Added quota tierId/tier_id fields to AuthFilesPage resolvePlanTypeForFile, and updated parseCodexUsagePayload to unwrap nested API-call envelope body payloads before deriving Codex planType.
- verification: pnpm run type-check, pnpm run lint, and pnpm run build passed; user confirmed the original No detected plan + probe selected workflow is fixed.
- files_changed: [src/pages/AuthFilesPage.tsx, src/utils/quota/parsers.ts]
