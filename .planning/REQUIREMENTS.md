# Requirements: Auth Files Batch Priority

**Defined:** 2026-05-20
**Core Value:** The UI must make high-risk backend management changes clear, fast, and reversible enough for a single operator to trust.

## v1 Requirements

### Auth Files Batch Priority

- [ ] **AFBP-01**: User can select multiple auth files and run a batch priority update from the Auth Files page.
- [ ] **AFBP-02**: User can choose a Team/Plus-first strategy that assigns selected auth files priority values favoring Team and Plus plans ahead of Free plans.
- [ ] **AFBP-03**: User can choose a Free-first strategy that assigns selected auth files priority values favoring Free plans ahead of Team and Plus plans.
- [ ] **AFBP-04**: Batch priority updates use the existing Management API priority field and report full or partial failures.
- [ ] **AFBP-05**: Selection state, filtering, and existing batch actions keep working after the new batch priority flow is added.

### UI and Localization

- [ ] **UI-01**: The new batch priority controls fit the existing Auth Files batch action bar without overlapping at supported responsive widths.
- [ ] **I18N-01**: New user-facing copy is present in `en`, `zh-CN`, `zh-TW`, and `ru` locale files.

### Validation

- [ ] **VAL-01**: `pnpm run type-check` passes.
- [ ] **VAL-02**: `pnpm run lint` passes or any pre-existing failures are explicitly separated from new failures.
- [ ] **VAL-03**: `pnpm run build` passes and still produces the management UI artifact.

## v2 Requirements

### Backend Efficiency

- **AFBP-V2-01**: If the Management API adds a true batch priority endpoint, the UI can switch from per-file patch calls to a single batch request.

## Out of Scope

| Feature                               | Reason                                                                                                   |
| ------------------------------------- | -------------------------------------------------------------------------------------------------------- |
| Backend batch endpoint implementation | This repository is only the React management UI.                                                         |
| Drag-and-drop priority reordering     | The requested scope is strategy-based batch priority, not manual ordering UX.                            |
| New test framework setup              | The repository currently has no test script or test config; validation uses type-check, lint, and build. |

## Traceability

| Requirement | Phase   | Status  |
| ----------- | ------- | ------- |
| AFBP-01     | Phase 1 | Pending |
| AFBP-02     | Phase 1 | Pending |
| AFBP-03     | Phase 1 | Pending |
| AFBP-04     | Phase 1 | Pending |
| AFBP-05     | Phase 1 | Pending |
| UI-01       | Phase 1 | Pending |
| I18N-01     | Phase 1 | Pending |
| VAL-01      | Phase 1 | Pending |
| VAL-02      | Phase 1 | Pending |
| VAL-03      | Phase 1 | Pending |

**Coverage:**

- v1 requirements: 10 total
- Mapped to phases: 10
- Unmapped: 0

---

_Requirements defined: 2026-05-20_
_Last updated: 2026-05-20 after GSD initialization repair_
