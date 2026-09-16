---
id: TASK-223
title: Separate compacted terminal route lanes
status: Done
assignee:
  - '@codex'
created_date: '2026-08-30 19:46'
updated_date: '2026-08-30 20:54'
labels: []
dependencies: []
references:
  - 'observed:edit'
  - 'observed:observed-curation'
  - 'observed:architecture-writer'
  - sheet
modified_files:
  - src/sheet/route-lanes.ts
  - test-bun/sheet-route.test.ts
  - src/sheet/route-geometry.ts
  - src/sheet/route.ts
type: bug
ordinal: 236000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
When long parallel relationship paths are compacted, a path body can become the literal final segment before its target. The lane-spacing pass currently treats that body like a fixed wall stub, leaving visibly crowded parallel lines. Web should apply the existing preferred lane gap while preserving exact wall endpoints.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Long parallel target approaches that become literal final segments after compaction use the existing preferred two-cell lane gap when the route remains safe
- [x] #2 Moving a terminal route body adds only the needed transition and keeps both wall endpoints exact
- [x] #3 Routes remain orthogonal and deterministic and do not create building intersections, shared path segments, or new crossings
- [x] #4 Short wall stubs and short endpoint-to-endpoint routes remain fixed
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [x] #1 Acceptance criteria have objective verification evidence.
- [x] #2 Relevant checks pass and changes remain task-scoped.
- [x] #3 Public contracts or documentation are updated when behavior changes.
- [x] #4 Implementation Plan reflects the final approach; correction history and verification are recorded in Implementation Notes.
<!-- DOD:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
Classify compacted final target bodies explicitly, move them with one short target transition while preserving the wall endpoints, allow only that same-target fan a bounded transition-crowding tolerance, and reject candidates that introduce building, clearance, shared-path, or proper route crossings. Run cleanup before the final preferred-spacing pass and verify the rule with a generic three-route fan.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
A symmetric source-side extension was tested and rejected because it changed established shared-source fan ordering. The approved example is a target approach, so the implementation remains target-scoped and preserves existing source behavior.

The quality review reproduced a new perpendicular route crossing after lane movement. The shared geometry layer now owns the proper route-crossing predicate, and preferred-lane candidates are rejected when they introduce a crossing that was not present before. The generic fixture verifies one transition jog per moved outer lane, unchanged endpoints and short routes, determinism, orthogonality, zero shared path, zero building crossings, and no new perpendicular crossing.

Focused routing tests pass 13/13. The 32 map and scene tests, focused Biome lint, TypeScript check, and diff check pass. The live target fan renders at y=39.6094815, 41.6094815, and 43.6094815 grid units. Full repository checks reach unrelated scan-watch tests but can fail when the shared process cannot create more file watchers (EMFILE); task-scoped checks remain green.

Wrap-up verification: the repository-wide bun run check now passes completely (lint with existing warnings only, TypeScript, 91 Node tests, and 195 Bun tests). The required complexity review traced raw routes through compaction, explicit endpoint-transition metadata, guarded lane candidates, and the final safety check. It found no authority-backed blocker. Its optional proposal to require every conflict segment to be terminal was not applied because no accepted fixture or supported-flow failure requires narrowing the already bounded target-fan rule.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Extended the existing sheet lane refiner so compacted routes sharing a target can reach the preferred two-cell body gap while preserving exact endpoints. Terminal moves add only one transition, stay orthogonal and deterministic, and are rejected if they introduce building contact, clearance loss, shared paths, or proper crossings. Reused crossing geometry across routing stages, covered the complete terminal-fan invariant in focused tests, and passed the full repository check and final complexity review.
<!-- SECTION:FINAL_SUMMARY:END -->
