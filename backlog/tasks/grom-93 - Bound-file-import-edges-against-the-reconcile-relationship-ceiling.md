---
id: GROM-93
title: Bound file-import edges against the reconcile relationship ceiling
status: Done
assignee:
  - '@codex'
created_date: '2026-07-21 17:22'
updated_date: '2026-07-21 18:02'
labels: []
dependencies: []
modified_files:
  - src/host/typescript-bun-scanner.ts
  - src/host/tests/typescript-bun-scanner.test.ts
ordinal: 89000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
GROM-91 added per-file import edges (relationshipType imports). These are bounded only by record/character budgets, not by a relationship count, but reconciliation enforces maxRelationships (~1000 non-containment relationships). On a repo of ~250-300+ files the file-import edges can exceed that ceiling and the scan HARD-FAILS with reconciliation-relationship-limit instead of degrading to partial — contradicting the topography's own 'partial not failed' contract (the component side already degrades gracefully). Fix: stop emitting imports/file-imports once the running non-containment relationship count approaches the ceiling and mark coverage partial, mirroring how component candidates are bounded. groma itself (77 files, 272 imports) is well under the limit, so this bites only larger repos. Found by the GROM-91 branch review.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 File-import (and aggregated import) emission is bounded against the reconcile relationship ceiling and degrades to partial rather than failing the scan
- [ ] #2 A test exercises a repo whose import edges would exceed the ceiling and asserts partial coverage, not a hard failure
- [ ] #3 bun run check stays green
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. Trace the TypeScript/Bun scanner's existing component/observation budget and import aggregation flow.
2. Reuse that budget to cap aggregate and per-file import relationships, marking coverage partial when observations are omitted.
3. Add one regression exceeding the relationship ceiling and assert successful partial publication.
4. Run targeted scanner tests and bun run check; record verification evidence.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Implemented a shared 1,000 non-containment import relationship budget across aggregated boundary imports and file-to-file imports. Aggregate emission now preflights the existing canonical-character headroom and reuse-breadth signals count only relationships actually published; omitted observations mark coverage partial. Added a dense 33-boundary regression with 1,056 directed imports that completes with partial coverage and emits no more than 1,000 import relationships.

Verification completed before the sweep override: `bun test src/host/tests/typescript-bun-scanner.test.ts` passed (80 tests, 777 assertions), and `git diff --check` passed. `bun run check` was started but explicitly terminated when the product owner overrode verification gates. Overall handoff status: unverified by product-owner instruction; AC #3 is intentionally unchecked.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Bounded aggregate and file-import observations to the existing relationship ceiling and degraded overflow to partial evidence. Unverified by product-owner instruction; acceptance criteria remain unchecked and no further local checks, CI wait, or review were performed.
<!-- SECTION:FINAL_SUMMARY:END -->
