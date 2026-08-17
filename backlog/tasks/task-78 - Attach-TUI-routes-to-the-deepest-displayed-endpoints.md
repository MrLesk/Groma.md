---
id: TASK-78
title: Attach TUI routes to the deepest displayed endpoints
status: Done
assignee:
  - '@claude'
created_date: '2026-08-17 17:52'
updated_date: '2026-08-17 18:00'
labels: []
dependencies: []
ordinal: 83000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Approved follow-up to TASK-77: the TUI draws relationships promoted to the current C4 level (displayEndpoint in projection.ts), so a person-to-component route renders as a synthesized arrow butting against the outer system wall even while the real leaf card is visible inside - a connection against the system. Relationships happen at the code level: attach each drawn route to the deepest displayed element for its true endpoint, following the ELK-laid route through boundary walls to the leaf card, and synthesize a promoted arrow only when the true endpoint is genuinely not displayed (hidden by the level rules). Level-based visibility of which relationships appear stays unchanged; only where routes attach changes. Identical synthesized arrows between the same promoted pair still collapse to one.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 When a relationship endpoint is displayed on screen, the drawn route attaches to that element itself and follows the laid-out route through boundary walls; no route terminates against an ancestor box that visibly contains its real endpoint
- [x] #2 When a true endpoint is hidden by the level rules, the route still promotes to its displayed ancestor, and identical promoted arrows between the same pair collapse to one
- [x] #3 Which relationships are visible at each level is unchanged; selection-driven relationship text still works against the resolved endpoints
- [x] #4 Verified in the terminal with agent-tty at the start view and after descending levels; bun test passes
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
1. Add an endpoint resolver in src/viewers/tui/projection.ts: walk up from the true endpoint to the first element whose projected display is not hidden; use it for route attachment in projectRelationships, keeping relationshipVisibleAtLevel untouched.
2. Treat a route as promoted only when a resolved endpoint differs from the true one; promoted pairs keep routeBetweenBoxes and dedupe by resolved pair, unpromoted pairs follow the ELK route with trim and attach.
3. Move the context-level top-ancestor dedupe out of visibleRelationships into the resolution-aware dedupe so unpromoted leaf routes are never collapsed.
4. Update any tests pinning level-based endpoint promotion; verify frames with agent-tty at the start view, after Enter descents, and at 200x60; bun test; cold simplicity review.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
resolveEndpoint in projection.ts walks up from the true endpoint to the first projected element that is not hidden and is inside the viewport; routes attach there, follow the ELK route (trim plus attach) when unpromoted, and synthesize routeBetweenBoxes arrows deduped per resolved pair only when promoted. relationshipVisibleAtLevel is untouched, so which relationships appear per level is unchanged; the old context-level top-ancestor dedupe moved into the promotion-aware dedupe. Verified with agent-tty at 140x40 and 200x60: context view now pierces the Groma wall and arrows into the leaf cards, containers view lands on container cards including a dashed ghost route into World building, components view crosses both walls to the focused card. Tests pinning level promotion rewritten: containers view asserts leaf attachment; a new components-level test asserts promotion to the nearest displayed ancestor when the endpoint is hidden. Behavior change accepted with the task: a route whose endpoint has no displayed ancestor at all (a person at components level) is dropped instead of drawn from an invisible box. Cold simplicity review: optional-only findings, all applied (ProjectedElement alias, doc clause about off-viewport promotion, visibleRelationships wrapper inlined). Non-blocking follow-ups recorded here: route labels can sit on a boundary bottom row, and at far zoom an arrowhead can overwrite a label glyph; both are cell-collision polish, not attachment defects. bunx tsc clean; bun test 144 pass.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
TUI routes now attach to the deepest displayed endpoint: resolveEndpoint replaces level-based endpoint promotion for drawing, so routes follow the ELK-laid path through boundary walls to the real leaf cards and only promote (synthesized, deduped arrows) when the endpoint is hidden by level rules or off viewport. Level visibility semantics unchanged; docs updated. Verified with agent-tty snapshots at context, containers, and components levels and at 200x60, bunx tsc, and bun test (144 pass).
<!-- SECTION:FINAL_SUMMARY:END -->
