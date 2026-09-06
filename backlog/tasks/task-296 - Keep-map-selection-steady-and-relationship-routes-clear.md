---
id: TASK-296
title: Keep map selection steady and relationship routes clear
status: Done
assignee:
  - '@codex'
created_date: '2026-09-06 12:35'
updated_date: '2026-09-06 13:08'
labels: []
dependencies: []
references:
  - render
  - iso-camera
  - iso-map
  - sheet-routing
  - iso-projection
modified_files:
  - src/viewers/web/iso/map.ts
  - src/viewers/web/iso/motion.ts
  - src/viewers/web/render.ts
  - src/sheet/route-geometry.ts
  - src/sheet/route-search.ts
  - src/sheet/route-spacing.ts
  - src/sheet/route-finish.ts
  - src/sheet/route.ts
  - test-bun/sheet-route.test.ts
  - test-bun/building-port-attachment.test.ts
  - test-bun/route-spacing.test.ts
  - docs/viewers/web/index.md
  - groma/relationships.md
type: bug
ordinal: 335000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
A developer browsing the web architecture map can select visible elements and task pins without moving the camera. Selections from panels and other controls outside the map bring their targets into view. Animated camera navigation uses the same cached rendering path as manual zoom. Relationship arrows attach away from building corners and remain visually distinct in the supplied Source viewer and Web viewer details example.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Selecting elements, relationships, or task pins directly on the map preserves the current camera; selections from outside the map retain camera focus.
- [x] #2 Animated camera focus prepares and uses cached map layers throughout the movement, then restores crisp rendering when movement ends.
- [x] #3 Route endpoints stay inside usable building wall spans rather than on corners in the supported routing fixtures and the supplied Groma example.
- [x] #4 Distinct relationship routes do not share visible line segments in the supplied example; routing clearance and direction remain correct.
- [x] #5 Focused camera and routing checks, live browser verification, and bun run check pass.
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
Trace pointer, panel, task-pin, and camera animation entry points. Preserve the camera for map-origin selection while retaining focus from panels and controls. Prepare the shared compositor layer before animated navigation. Reproduce corner attachments and shared visible segments through the live Groma geometry, then fix the smallest routing or projection cause with minimal synthetic geometry checks. Update the web behavior documentation, verify the affected flows in the browser, and run bun run check.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Implementation: map element and relationship callbacks and task-pin callbacks preserve the displayed camera and cancel any unfinished focus animation. Hierarchy, Details, flow, search and task-chip entry points retain focus. The camera animator prepares the existing cached camera layer before scheduling its first frame.

Routing: original ports and shortcut wall spans use the middle half of the usable wall. Parallel runs closer than three ground-plane pixels count as overlapping. The final routing pass shifts crowded runs to nearby clear tracks while keeping wall attachment and obstacle clearance. Existing route safety checks validate the result. Route-search.ts was explored and restored; it has no final task diff.

Verification: the captured Groma example routes all 113 relationships with no shared runs or building-clearance failures. The Source viewer departure is about 6.7 projected pixels from the nearest visible corner. A projected audit reduced 18 long near-overlap pairs to no long overlapping parallel strokes; the remaining near pair is only a 1.2-pixel bend adjacency. Synthetic tests cover close parallel strokes, direction and attachment preservation, and stepped-roof corner avoidance. The mixed-turn fan test now exercises fan ordering directly, since central-wall shortcuts can correctly choose a different exit side.

Browser verification: selecting Source viewer on the map preserves its exact camera transform. Clicking the actual Source viewer relationship after manually zooming out preserves that transform and selects the relationship. Clicking a TASK-296 pin preserves the full-map transform; selecting its chip changes the camera to fit active work. A Details endpoint button changes focus to the selected component. During panel focus, all 57 captured moving frames retain one unchanged SVG transform and the prepared CSS camera layer; the largest captured frame interval is 9.4 ms. Settling clears the CSS transform and restores the SVG at the final camera position.

Checks: bun run check passes with 106 Node tests and 324 Bun tests. Six existing complexity warnings remain outside changed functions. The initial fixture type errors and new complexity warning were corrected. The file-watch test needs normal macOS FSEvents access; the complete check passes with that access. Changed source and test files remain below 500 lines. Task diff passes whitespace checks. Web documentation describes the final behavior.

Implementer specification and quality reviews pass. These are repairs to existing presentation and routing behavior, with no architecture-model change, new abstraction or compatibility layer. OKF Markdown meaning and C4 endpoints are unchanged; Groma owns camera navigation and geometric route presentation. The geometry rules depend on building dimensions and projected strokes, not repository names or programming languages. No authority-backed blocking finding remains. Changes await user confirmation before committing, as required by AGENTS.md.

The running architecture scanner also updated groma/relationships.md: the pointer.ts → render.ts interaction now records the supplied select callback introduced by map-origin selection wiring. This generated change belongs to TASK-296 and remains excluded from the separate TASK-294/295/156 commit series. The architecture file was not edited by hand.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Map selections and task pins keep the camera steady; panel and chip selections focus their targets. Focus animation prepares the shared rendering cache. Relationship ports avoid corners and close parallel runs separate. Verified in the browser, against all 113 routes in the supplied example, and with bun run check (430 tests).
<!-- SECTION:FINAL_SUMMARY:END -->
