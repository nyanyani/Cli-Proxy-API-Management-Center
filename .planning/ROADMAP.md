# Roadmap: CLI Proxy API Management Center

## Overview

This milestone adds one focused Auth Files enhancement: a batch priority action for selected auth files. Because this is a brownfield React UI with an existing Auth Files page, selection model, and single-file priority patch API, the work should be delivered as one vertical slice spanning hook logic, page controls, localization, styling review, and standard pnpm validation.

## Phases

**Phase Numbering:**

- Integer phases (1, 2, 3): Planned milestone work
- Decimal phases (2.1, 2.2): Urgent insertions (marked with INSERTED)

- [ ] **Phase 1: Auth Files Batch Priority** - Add Team/Plus-first and Free-first batch priority updates for selected auth files.

## Phase Details

### Phase 1: Auth Files Batch Priority

**Goal**: Selected auth files can be batch-updated with deterministic priority strategies from the existing Auth Files batch action bar.
**Depends on**: Nothing (first phase)
**Requirements**: [AFBP-01, AFBP-02, AFBP-03, AFBP-04, AFBP-05, UI-01, I18N-01, VAL-01, VAL-02, VAL-03]
**Success Criteria** (what must be TRUE):

1. User can select auth files and trigger Team/Plus-first priority updates.
2. User can select auth files and trigger Free-first priority updates.
3. The UI reports success and partial failure for per-file priority updates.
4. Existing selected-file batch enable, disable, delete, download, and filter flows still work.
5. Type-check, lint, and build are run before shipping.
   **Plans**: 1 plan

Plans:

- [ ] 01-01: Implement and validate batch priority strategy controls.

## Progress

**Execution Order:**
Phases execute in numeric order: 1

| Phase                        | Plans Complete | Status      | Completed |
| ---------------------------- | -------------- | ----------- | --------- |
| 1. Auth Files Batch Priority | 0/1            | Not started | -         |
