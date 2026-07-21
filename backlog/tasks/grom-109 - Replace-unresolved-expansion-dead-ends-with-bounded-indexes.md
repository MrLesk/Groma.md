---
id: GROM-109
title: Replace unresolved expansion dead ends with bounded indexes
status: Done
assignee:
  - '@codex'
created_date: '2026-07-21 22:53'
updated_date: '2026-07-21 23:03'
labels:
  - frontend
  - ux
  - visual-blueprint
dependencies:
  - GROM-108
references:
  - MANIFESTO.md
  - brand/STYLE.md
  - docs/interface-glossary.md
modified_files:
  - src/web/client/model.ts
  - src/web/client/graph.ts
  - src/web/client/canvas.tsx
  - src/web/tests/model.test.ts
  - tests/organization-scale/verify.ts
priority: high
type: bug
ordinal: 99000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Expanded observed areas must remain useful when path evidence cannot produce a semantic subgroup within the visual node budget. Replace the opaque Structure not mapped terminal card with deterministic disposable component-index groups that preserve bounded density, account for every component, and can be expanded until the real observed components are reachable. Index groups are presentation only and never claim canonical architectural meaning.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Expanding an ungroupable over-budget observed area shows bounded navigable index groups instead of a Structure not mapped terminal card
- [x] #2 Each index group expands to real observed components, recursively introducing another bounded index level only when required
- [x] #3 Every source component remains accounted for with no arbitrary omission, pagination, or canonical mutation
- [x] #4 Index membership, labels, IDs, and ordering are deterministic across input order
- [x] #5 The OpenClaw Source modules area exposes its 49 components through usable bounded groups
- [x] #6 Focused tests and live browser QA cover overview, index expansion, real-component reachability, and console health
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. Replace the unresolved-mapping fallback with a deterministic recursively bounded component index built from sorted real component display names and stable IDs; cap every index layer at the existing 20-node visual budget. 2. Add an observed-index disposable projection kind and make its cards expand with the same component disclosure and independent collapse behavior as evidence-derived groups. 3. Update generic and OpenClaw projection tests to prove complete accounting, input-order determinism, bounded recursion, and reachability of real components. 4. Run formatting, focused and full tests, TypeScript and architecture checks, a production build, and live OpenClaw browser QA through overview, index, and real-component expansion.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Implemented a disposable observed-index projection that sorts real components by display name and stable ID, partitions each presentation level into at most 20 deterministic ranges, and recurses only when a range still exceeds the visual budget. Validation: 524/524 Bun tests passed; web TypeScript check, architecture boundaries, and production native build passed. Full typecheck remains blocked only by the unrelated in-progress GROM-107 fixture at tests/organization-scale/verify.ts:546 still using removed focusPath. Browser QA at http://127.0.0.1:1235/ against the real OpenClaw generation 2 blueprint verified overview -> Source modules -> three 20/20/9 index ranges -> 20 real components; console warnings/errors were empty.

Pre-PR integration migrated the organization-scale fixture from the removed focusPath option to expandedIds after GROM-107 merged. The complete bun run check now passes, including formatting, both TypeScript configs, boundaries, 525 tests, native build/smoke, and Iteration 1A verification.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Replaced the Structure not mapped expansion dead end with deterministic, recursively bounded component indexes. Verified complete/deterministic projection behavior in focused tests, all 524 repository tests, production build, boundary/type checks for the changed web surface, and live OpenClaw browser interaction through a real component leaf with a clean console.
<!-- SECTION:FINAL_SUMMARY:END -->
