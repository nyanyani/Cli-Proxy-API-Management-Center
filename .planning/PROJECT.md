# CLI Proxy API Management Center

## What This Is

CLI Proxy API Management Center is the React management UI for administering a running CLI Proxy API backend. It lets a personal operator inspect quotas, manage auth files, and trigger management operations from the standalone `management.html` build artifact.

## Core Value

The UI must make high-risk backend management changes clear, fast, and reversible enough for a single operator to trust.

## Requirements

### Validated

- ✓ Auth Files management UI exists with selection, filtering, status changes, delete, and download flows — existing codebase
- ✓ Management API client injects the configured management key and targets `/v0/management` — existing codebase
- ✓ User-facing copy is localized across English, Simplified Chinese, Traditional Chinese, and Russian — existing codebase

### Active

- [ ] Add a batch priority action for selected auth files.
- [ ] Support deterministic priority ordering strategies: Team/Plus-first and Free-first.
- [ ] Preserve existing Auth Files selection, filtering, and batch operation behavior.
- [ ] Use the existing single-file priority patch API unless a true backend batch endpoint exists.
- [ ] Keep the release artifact hash-router-safe and standalone.

### Out of Scope

- Backend Management API changes — this repository is the React UI only.
- New package manager or workspace setup — this is a single-package pnpm project.
- Persisting real management keys in fixtures, logs, or docs — credentials are sensitive.

## Context

- The app is a Vite + React + TypeScript management UI.
- Entry flow is `src/main.tsx` -> `src/App.tsx` -> `MainLayout` -> `src/router/MainRoutes.tsx`.
- Auth Files state and hooks live under `src/features/authFiles/`.
- API wrappers live under `src/services/api/`; `authFilesApi.patchFields(name, fields)` already supports `priority?: number` for single-file updates.
- Existing batch operations are client-side loops over selected files, so batch priority should follow that pattern unless backend support is added.
- User-facing copy must update all locale files: `en`, `zh-CN`, `zh-TW`, and `ru`.

## Constraints

- **Tech stack**: React, Vite, TypeScript, SCSS modules, Zustand, i18next — match existing patterns.
- **Package manager**: Use pnpm, not npm — CI and `pnpm-lock.yaml` are authoritative.
- **Backend boundary**: Do not assume backend endpoints beyond the Management API wrappers present in `src/services/api/`.
- **Build artifact**: Keep hash routing and standalone `dist/management.html` behavior intact.
- **Type safety**: TypeScript is strict with `noUnusedLocals` and `noUnusedParameters`.

## Key Decisions

| Decision                                                                | Rationale                                                                                                                             | Outcome   |
| ----------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------- | --------- |
| Initialize GSD as a brownfield UI project                               | The repository already contains a functioning management UI; planning should reflect current code rather than greenfield assumptions. | — Pending |
| Implement batch priority through existing single-file patch calls first | Explorer found no backend batch fields endpoint, while `patchFields` already supports `priority`.                                     | — Pending |
| Offer explicit strategy actions instead of freeform hidden ordering     | Team/Plus-first and Free-first need deterministic, understandable effects.                                                            | — Pending |

---

_Last updated: 2026-05-20 after GSD initialization repair_
