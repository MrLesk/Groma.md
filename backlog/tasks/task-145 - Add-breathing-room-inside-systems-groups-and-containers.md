---
id: TASK-145
title: 'Add breathing room inside systems, groups, and containers'
status: Done
assignee:
  - '@codex'
created_date: '2026-08-23 16:27'
updated_date: '2026-08-23 17:20'
labels: []
dependencies: []
references:
  - sheet
  - iso-map
  - iso-projection
modified_files:
  - src/sheet/grid.ts
  - src/sheet/place.ts
  - test-bun/sheet-scene.test.ts
  - docs/viewers/web/index.md
  - src/viewers/web/iso/style.ts
  - src/viewers/web/iso/project.ts
  - test-bun/iso-map.test.ts
  - src/viewers/web/iso/paint-ground.ts
  - src/viewers/web/iso/text.ts
type: enhancement
ordinal: 156000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
When an architect opens the web map, system islands, sibling group zones, and container slabs should leave a visibly wider, symmetric interior margin around their contents. Their names should remain in the compact edge band so the labels do not consume that content space or collide with nearby surfaces. The internal system surface should use a slightly lighter gray, and its name should have the same translucent background used by the other island names.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 System islands, sibling group zones, and container slabs show symmetric extra space between their contents and all four parent edges, while their labels stay in the compact edge band without colliding with nearby surfaces
- [x] #2 The extra content space comes from coherent shared sheet-layout rules rather than viewer-only offsets, and the composed layout remains deterministic
- [x] #3 Focused layout checks cover the increased content insets and compact label band without asserting decorative pixels or prose
- [x] #4 The web viewer contract distinguishes roomier nested contents from compact edge labels
- [x] #5 The internal system island uses a slightly lighter gray derived from the shared map tint scale
- [x] #6 The internal system name has the same translucent background chip as the other island names
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
1. src/sheet/grid.ts: distinguish the packer's one-cell minimum from a shared two-cell inset for nested architecture content, named so it cannot be confused with people and external islands.
2. src/sheet/place.ts: expand system islands, container slabs and group zones by only the difference between those insets, shifting their children equally so placement stays symmetric and deterministic; keep people and external islands compact and centred.
3. src/viewers/web/iso/project.ts: keep every surface label in the compact one-cell edge band instead of reusing the larger content inset.
4. test-bun/sheet-scene.test.ts and test-bun/iso-map.test.ts: assert the larger content policy, all-four-edge child inset and compact label projection.
5. src/viewers/web/iso/style.ts: derive a slightly lighter system-island fill from the existing grayscale depth scale and keep the stylesheet contract accurate.
6. src/viewers/web/iso/paint-ground.ts and text.ts: give every island name the existing translucent chip, including the plain system island, and keep the chip contract accurate.
7. docs/viewers/web/index.md: distinguish roomier nested contents from compact edge labels and describe the system tone and name chip.
8. Run focused sheet checks, isolated routing checks, full project checks and rendered comparison against the supplied screenshots.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Implemented one shared two-cell nested-surface inset for system islands, container slabs and group zones; people and external islands keep their compact centred rule. Focused sheet scene and growth checks pass: 21 tests.

Cold simplicity review found that the broad inset test had no zone fixture. Moved all-four-edge group coverage into the existing grouped-world test and removed the unexercised branch. Focused sheet checks pass 21/21 and TypeScript passes. Browser QA at fit and 195% shows the roomier system, slab, and group surfaces; the computed system tint is 3.0% ink versus 4.0% for the neighboring people island. An isolated HEAD worktree with only TASK-145 layout changes passes all 36 sheet scene, growth, and routing checks. The shared live tree still has unrelated TASK-143 route-test failures and a scanner test that targets a concurrently moved backlog plugin file.

The full-context architecture review found that labels still used the compact one-cell band. Routed NESTED_SURFACE_PAD through projection for system, slab and zone labels, while people and external labels explicitly keep PAD. Renamed the policy to prevent broad misuse, added a nested-greater-than-compact guard and a minimal four-surface projection fixture, and corrected the tint-scale comment. Final focused projection, scene and growth checks pass 33/33; TypeScript and diff checks pass. The full project check remains blocked only by the concurrent scanner test expecting the moved src/backlog-plugin.ts path.

Added the existing translucent island-name chip to the plain system label by removing the island-kind exception in paint-ground.ts; no new style token or component was introduced. Updated the web contract. Focused iso-map and page checks pass 14/14, and the browser renders one chip for both the system and people labels at fit and 195% with no console warnings. The shared full check is currently blocked by concurrent web URL tests still using the removed ViewState.selection field.

Alex’s screenshot showed the larger content inset had been incorrectly reused for surface labels, moving them only perpendicular to the edge and bringing GROMA against Terminal viewer. Restored one compact PAD-owned label band for every surface and removed the projection inset parameter; nested contents still keep symmetric NESTED_SURFACE_PAD on all four edges. Updated the projection fixture and web contract. Focused scene, growth, projection and page checks pass 35/35. Browser bounding boxes prove GROMA and Terminal viewer do not overlap at fit or 195%, and the console is clean.

The final architecture review required the authority name to match its content-only role. Renamed NESTED_SURFACE_PAD to NESTED_CONTENT_PAD, documented PAD as the compact label edge inset, and made the projection test atomic by removing the content-policy dependency. Targeted re-review passes with no remaining issues. Focused tests pass 35/35; the current shared typecheck is blocked only by concurrent tree/navigation signature edits outside TASK-145.
<!-- SECTION:NOTES:END -->

## Comments

<!-- COMMENTS:BEGIN -->
author: @codex
created: 2026-08-23 16:46
---
Implementation and required reviews pass. Ready for Alex's visual approval; keep In Progress until approval, then commit only TASK-145 files and push.
---

author: @codex
created: 2026-08-23 16:52
---
The system-label chip refinement and full-context architecture review pass. Ready for Alex's visual approval; keep In Progress until approval, then commit only TASK-145 hunks and push.
---

author: @codex
created: 2026-08-23 17:10
---
Corrected after Alex's screenshot: content padding and label padding now have separate, clearly named authorities. Reviews and focused QA pass. Keep In Progress for Alex's visual approval; then commit only TASK-145 hunks and push.
---

author: @codex
created: 2026-08-23 17:20
---
Alex approved the visual result. Finalizing for task-scoped commit and push.
---
<!-- COMMENTS:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Added symmetric two-cell NESTED_CONTENT_PAD around system, container and group contents while keeping every surface name in the compact one-cell PAD edge band, preventing the GROMA and Terminal viewer labels from meeting. Made the system surface a half tint step lighter and reused the existing translucent island-name chip for the system name. Verified with 35 focused scene/growth/projection/page tests, browser measurements showing no label overlap at fit or 195%, clean browser logs, prior isolated routing and TypeScript checks, and targeted architecture re-review. The current shared typecheck/full check is blocked only by concurrent tree/navigation edits and the scanner test for a moved backlog plugin file.
<!-- SECTION:FINAL_SUMMARY:END -->
