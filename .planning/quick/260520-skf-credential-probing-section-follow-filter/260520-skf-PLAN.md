---
quick_id: 260520-skf
slug: credential-probing-section-follow-filter
type: quick
autonomous: true
files_modified:
  - src/pages/AuthFilesPage.tsx
requirements:
  - QUICK-260520-SKF
must_haves:
  truths:
    - "When an Auth Files filter/search is active, the Credential probing panel probes only credentials in the current filtered result set."
    - "The probe summary in the Credential probing panel reflects the same filtered result set the panel action will probe."
    - "Existing automation actions keep their current sorted filtered-scope behavior."
  artifacts:
    - path: "src/pages/AuthFilesPage.tsx"
      provides: "Filtered credential probing target and summary wiring"
  key_links:
    - from: "src/pages/AuthFilesPage.tsx probe panel button"
      to: "src/pages/AuthFilesPage.tsx sorted filtered auth file list"
      via: "filtered probe target names passed into probeCredentials"
      pattern: 'probeCredentials\(new Set\(.*filtered.*\)'
---

<objective>
Make the Auth Files Credential probing section respect the currently selected filters without redesigning the page.

Purpose: The page already has a filtered/sorted result set (`sorted`) used by selection and automation. The probe panel currently has a broader `Probe all` path that calls `probeCredentials()` with no target set, causing it to fetch and probe every backend auth file even when the user has narrowed the page to a provider/search/status subset. This plan makes the probe panel follow the same visible filtered universe.

Output: A focused change in `src/pages/AuthFilesPage.tsx` that scopes probe-panel target selection and summary calculation to the active filtered result set.
</objective>

<execution_context>
@AGENTS.md
@.planning/STATE.md
</execution_context>

<context>
Key code facts from inspection:

- `src/pages/AuthFilesPage.tsx` owns the Auth Files page state and probe UI.
- Active filters/search are applied in two stages:
  - `filesMatchingStatusFilters` applies probe/status/runtime/plan/advanced filters.
  - `filtered` applies provider tag and search.
  - `sorted` is the final filtered result set used for visible selection and automation actions.
- Existing automation probing already scopes through `getAutomationTargetNames`, which uses `sorted`.
- The Credential probing panel button currently calls `handleProbeAllCredentials`, which calls `probeCredentials()` without target names, so `probeCredentials` probes all files returned from `authFilesApi.list()`.
- `probeCredentials(targetNames?: Set<string>)` already supports scoped probing by name at lines 1701-1703.
- There is no test script in this repo. Use `pnpm run type-check`, `pnpm run lint`, and `pnpm run build` for automated verification.

Relevant current flow:

```tsx
const handleProbeAllCredentials = useCallback(() => probeCredentials(), [probeCredentials]);

const getAutomationTargetNames = useCallback(
  (predicate: (file: AuthFileItem) => boolean) =>
    sorted.filter((file) => predicate(file)).map((file) => file.name),
  [sorted]
);

const probeSummary = useMemo(() => {
  const probeableFiles = files.filter(isProbeableCredential);
  ...
}, [files, probeState]);
```

Desired scoped flow:

```tsx
const probePanelFiles = sorted;
const probePanelTargetNames = useMemo(
  () => probePanelFiles.filter(isProbeableCredential).map((file) => file.name),
  [probePanelFiles]
);

const handleProbeFilteredCredentials = useCallback(() => {
  if (probePanelTargetNames.length === 0) {
    notifyNoAutomationTargets();
    return;
  }
  void probeCredentials(new Set(probePanelTargetNames));
}, [notifyNoAutomationTargets, probeCredentials, probePanelTargetNames]);
```

Do not add dependencies. Do not add broad UI redesign. Avoid locale changes unless executor intentionally changes visible copy; if copy changes, update all locale JSON files (`en`, `zh-CN`, `zh-TW`, `ru`).
</context>

<tasks>

<task type="auto" tdd="false">
  <name>task 1: scope probe-panel targets to current filters</name>
  <files>src/pages/AuthFilesPage.tsx</files>
  <action>
    Replace the unscoped `handleProbeAllCredentials` path with a filtered probe-panel target list derived from `sorted` after all current filters/search/sort have been applied. Use the existing `probeCredentials(targetNames?: Set&lt;string&gt;)` support rather than changing probe request internals. If no filtered probeable credentials exist, show the existing `automation_no_matches` warning through `notifyNoAutomationTargets` instead of starting a zero-target probe. Keep `handleProbeSelectedCredentials` unchanged so selected probing still probes explicit selections regardless of whether those selected names are currently visible.
  </action>
  <verify>
    <automated>pnpm run type-check</automated>
  </verify>
  <done>
    Clicking the Credential probing panel action while filters/search are active passes only names from `sorted.filter(isProbeableCredential)` into `probeCredentials`; clicking it with no probeable filtered matches shows the existing no-matches notification; selected probing behavior is unchanged.
  </done>
</task>

<task type="auto" tdd="false">
  <name>task 2: make probe summary use the same filtered scope</name>
  <files>src/pages/AuthFilesPage.tsx</files>
  <action>
    Update `probeSummary` to summarize the same filtered probe-panel file set used by the panel action, not the full `files` array. Include `probeState` and the filtered probe-panel files in the memo dependencies. Preserve the existing summary fields (`authErrors`, `errors`, `filesWithoutCredentials`, `skipped`, `success`, `checked`, `total`, `unprobed`) and their meanings within the filtered scope. Do not alter automation panel actions, pagination, selection, or quota refresh behavior.
  </action>
  <verify>
    <automated>pnpm run lint</automated>
  </verify>
  <done>
    The Credential probing summary counts only files currently included by active filters/search, and the repository passes lint and build with no unused symbols or TypeScript errors.
  </done>
</task>

</tasks>

<threat_model>
## Trust Boundaries

| Boundary | Description |
|----------|-------------|
| Browser UI → Management API | Probe action sends auth file names selected in the UI to existing management/probe APIs. |
| localStorage/session state → UI filters | Persisted UI filter/probe state affects which names are selected for probing. |

## STRIDE Threat Register

| Threat ID | Category | Component | Disposition | Mitigation Plan |
|-----------|----------|-----------|-------------|-----------------|
| T-260520-SKF-01 | Tampering | `probeCredentials(new Set(names))` | mitigate | Derive names only from existing `AuthFileItem.name` values in the current `sorted` array; do not accept arbitrary typed input for probe targets. |
| T-260520-SKF-02 | Information Disclosure | Probe summary | accept | Summary already displays aggregate counts only; this change narrows scope to the filtered set and does not expose credential contents. |
| T-260520-SKF-03 | Denial of Service | Probe all action | mitigate | Scoping the action to filtered probeable names reduces accidental broad probe runs; preserve existing `probeRunning` disable gate and no-target warning. |
</threat_model>

<verification>
Run:

```bash
pnpm run type-check
pnpm run lint
pnpm run build
```

Targeted inspection:

```bash
rg "handleProbeAllCredentials|probePanelTargetNames|probeSummary|probeCredentials\(new Set" src/pages/AuthFilesPage.tsx
```

Manual smoke check if a backend is available:

1. Start `pnpm run dev` and connect to the Management API.
2. Open Auth Files.
3. Select a provider/search/status filter that leaves a smaller result set.
4. Trigger the Credential probing panel action.
5. Confirm the progress total and final summary correspond to the filtered probeable set, not all backend files.
</verification>

<success_criteria>
- The probe panel action respects the current filtered result set.
- The probe panel summary reflects that same filtered result set.
- No broad UI redesign, dependency change, or unrelated Auth Files behavior change is introduced.
- `pnpm run type-check`, `pnpm run lint`, and `pnpm run build` pass.
</success_criteria>

<output>
After completion, create `.planning/quick/260520-skf-credential-probing-section-follow-filter/260520-skf-SUMMARY.md` with changed files, verification commands, and behavioral notes.
</output>
