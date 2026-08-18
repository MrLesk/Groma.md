---
id: TASK-95.1
title: Encode the city contract in core
status: Done
assignee:
  - '@grok'
created_date: '2026-08-18 20:48'
updated_date: '2026-08-18 21:11'
labels: []
dependencies:
  - TASK-94
references:
  - src/semantic-view.ts
  - src/types.ts
  - test/fixtures/openclaw-view
documentation:
  - docs/viewers/index.md
parent_task_id: TASK-95
priority: high
type: feature
ordinal: 101000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
When an architect asks core for a C4 level, Groma names that level of internal software, keeps the next software layer as underlay, and treats people and external systems as marks. The campus geometry is the existing world-layout wrappers from code up. Camera scale is the only shrink. Entering a system does not move that system, its people, or sibling systems.

This task encodes the contract and fixture tests only. It does not paint SVG or TUI, add cone arrows, or change chrome.

Ghost means planned. Underlay is the unnamed next software layer, not a ghost.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 At Context, a fixture system keeps its campus wrapper size from world-layout, not a name-only collapsed card
- [x] #2 The named level lists internal software of that C4 kind; the next software layer is present as underlay, not as named cards and not as planned ghosts
- [x] #3 People and external systems are marks: same world origin as the campus, drawn size follows the named level
- [x] #4 Entering a system does not move that system, its people, or sibling systems
- [x] #5 Viewer docs state this contract and retire the collapse-before-size description
- [x] #6 Fixture tests cover named, underlay, and mark rules; bun test of the changed files passes
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
Adapt `semanticView` in place. One campus from world-layout; no second ELK city.

1. Replace `SemanticItem.collapsed` with `role: 'named' | 'underlay' | 'mark' | 'campus'`. Software wrappers (named, underlay, campus) copy world-layout bounds. Marks keep world (x, y) and use name-capable `displaySize` of the named C4 kind (system / container / component).
2. Visibility: people and external systems are always marks. Context names internal systems and keeps their containers as underlay. Containers names the focused system's containers, keeps their components as underlay, and keeps internal systems as campus. Components names the focused container's components, keeps that container and internal systems as campus, and has no underlay.
3. Promote relationship endpoints to the nearest non-underlay item. Do not attach edges to underlay. Ghost stays `origin === 'planned'` on the world; never a city role.
4. Delete `src/semantic-layout.ts` and `test-bun/semantic-layout.test.ts` (retired collapse + second-city ELK).
5. Rewrite `test-bun/semantic-view.test.ts` (shop world + planned underlay + sibling system) and `test-bun/openclaw-view.test.ts` (OpenClaw Context/Containers named/underlay/mark and still origins).
6. Replace the collapse-before-size paragraph in `docs/viewers/index.md` with this contract.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Encoded the city contract in `semanticView`. Software wrappers keep world-layout bounds. `SemanticItem.role` is named / underlay / mark / campus. Marks keep world origin and use `displaySize` of the named C4 kind. Planned parts can be underlay; there is no ghost role. Deleted the TASK-93 second-city ELK module.

Simplicity review: dropped sibling-container campus at Components (only the focused container stays as campus). Docs rewritten from a cold-reader POV.

Verification:
- bun test test-bun/semantic-view.test.ts test-bun/openclaw-view.test.ts — 10 pass
- bunx tsc --noEmit — clean

Spec review: compliant. Quality review: approved (minor follow-ups only). Orchestrator re-ran bun test test-bun/semantic-view.test.ts test-bun/openclaw-view.test.ts — 10 pass. bunx tsc --noEmit clean.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
semanticView is the city contract: software wrappers keep world-layout size, items carry named/underlay/mark/campus roles, marks keep world origin and follow named-level size, Enter does not move system/people/siblings. Collapse-before-size docs and the second-city ELK module are gone. Verified with bun test test-bun/semantic-view.test.ts test-bun/openclaw-view.test.ts (10 pass) and bunx tsc --noEmit. Spec and quality reviews approved.
<!-- SECTION:FINAL_SUMMARY:END -->
