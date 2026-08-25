---
id: TASK-169
title: Bring the web architecture experience to the terminal
status: Done
assignee:
  - '@codex'
created_date: '2026-08-24 19:54'
updated_date: '2026-08-25 21:00'
labels: []
dependencies: []
references:
  - semantic-view
  - projection
  - projection-camera
  - navigation-spatial
  - screen
  - navigation
  - camera
  - terminal-viewer
  - layout
  - projection-routes
  - relationship-text
  - view-host
  - work-projection
  - sheet
  - tree
  - semantic-city
modified_files:
  - src/semantic-view.ts
  - src/viewers/tui/projection-display.ts
  - src/viewers/tui/projection-camera.ts
  - src/viewers/tui/projection.ts
  - src/viewers/tui/navigation-spatial.ts
  - src/viewers/tui/terminal-viewer.ts
  - src/viewers/tui/organisms/chrome.ts
  - src/viewers/tui/paint.ts
  - src/viewers/tui/atoms/theme.ts
  - src/viewers/tui/molecules/hatch.ts
  - src/viewers/tui/molecules/boundary.ts
  - src/viewers/tui/molecules/card.ts
  - src/viewers/tui/organisms/world.ts
  - src/viewers/tui/navigation.ts
  - src/viewers/tui/camera.ts
  - test-bun/camera.test.ts
  - test-bun/chrome.test.ts
  - test-bun/navigation.test.ts
  - test-bun/projection.test.ts
  - test-bun/semantic-view.test.ts
  - test-bun/tui-theme.test.ts
  - AGENTS.md
  - docs/viewers/tui/index.md
  - groma/observed/systems/groma/containers/terminal-viewer/components/camera.md
  - groma/observed/systems/groma/containers/terminal-viewer/container.md
  - >-
    groma/observed/systems/groma/containers/terminal-viewer/components/navigation-spatial.md
  - src/types.ts
  - >-
    groma/observed/systems/groma/containers/terminal-viewer/components/navigation.md
  - >-
    groma/observed/systems/groma/containers/terminal-viewer/components/projection-camera.md
  - >-
    groma/observed/systems/groma/containers/terminal-viewer/components/projection.md
  - groma/observed/systems/groma/containers/terminal-viewer/components/screen.md
  - test-bun/projection-routes.test.ts
  - test-bun/tui-campus.test.ts
  - src/viewers/tui/layout.ts
  - src/viewers/tui/projection-routes.ts
  - src/viewers/tui/molecules/route.ts
  - src/viewers/tui/molecules/selection.ts
  - >-
    groma/observed/systems/groma/containers/terminal-viewer/components/relationship-text.md
  - src/viewers/tui/model.ts
  - src/view-host.ts
  - src/work/projection.ts
  - src/viewers/tui/molecules/work-marker.ts
  - src/viewers/tui/organisms/details.ts
  - src/viewers/tui/atoms/border.ts
  - test-bun/helpers.ts
  - test-bun/viewer-lifecycle.test.ts
  - groma/observed/systems/groma/containers/view-host/container.md
  - groma/observed/systems/groma/containers/core/components/sheet.md
  - src/semantic-city.ts
  - test-bun/openclaw-view.test.ts
  - src/viewers/tui/tree.ts
  - test-bun/tree.test.ts
  - src/element-order.ts
  - docs/scanners/typescript/expected.txt
  - groma/observed/systems/groma/containers/core/components/semantic-city.md
  - groma/observed/systems/groma/containers/core/components/semantic-view.md
  - docs/viewers/creating-a-plugin.md
  - docs/viewers/index.md
  - src/viewers/tui/flow.ts
  - src/viewers/tui/molecules/flow-marker.ts
priority: high
type: feature
ordinal: 180000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
When a developer runs `groma view`, Groma shows a readable terminal-native projection of the same architecture meaning as the web viewer. The root map keeps actors on the left, internal systems with their containers and collapsed groups in the middle, and external systems on the right. A container can open a fixed-scale child map containing its groups and components. The hierarchy and optional details panel remain available for fast navigation and inspection. The map derives grayscale shades and patterns from the terminal palette for light and dark themes; Groma green is its only chromatic map accent.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 The root map shows actors, internal systems, their containers and collapsed named groups, and external systems without showing component cards.
- [x] #2 Enter opens a selected container as a fixed-scale map of its groups and components, Backspace returns to the root map, and no geometric zoom changes the scale.
- [x] #3 The persistent hierarchy lists flows and architecture with the shared `●` actor, `■` system, `□` container, and `▪` component glyphs and stays synchronized with map selection.
- [x] #4 The details panel reserves terminal width when open, shows the current selection, and can be closed without changing world geometry.
- [x] #5 Active flows highlight their promoted routes while unrelated architecture remains visible and stable.
- [x] #6 The map derives a readable grayscale from light and dark terminal palettes, distinguishes actors, systems, containers, groups, and external systems without relying on hue, and uses Groma green as its only colored map accent.
- [x] #7 Architecture and work refreshes preserve valid selection, scope, and viewport state without rearranging the visible map unnecessarily.
- [x] #8 Focused automated tests cover scope transitions, projection and layout invariants, navigation, camera stability, palette rules, world immutability, and lifecycle; `groma view` is visually checked at 120x36 and 200x60.
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
1. Replace the TUI old ELK ArchitectureWorld and semantic-view projection with the same ArchitectureGraph plus SheetScene used by the web viewer. The sheet is the single geometry and routing authority; do not touch the parallel routing experiment or dirty web files.
2. Project the sheet top-down at one fixed readable scale: one sheet cell is one terminal column and half a terminal row. Root paints actor, internal-system and external-system islands, container slabs, and collapsed component-group zones while hiding component buildings. Container scope paints the selected slab, its zones, and its component buildings.
3. Start on the internal system with hierarchy, map selection and details synchronized. Keep one stable canvas; selection only pans enough to reveal the selected shape. Enter opens containers and Backspace restores root.
4. Reuse SheetScene route points. Promote hidden component endpoints to their visible slab or boundary, trim routes at those visible bounds, and paint clean orthogonal lines with box-drawing corners, a source port and a directed arrowhead. Keep neutral routes visible and use terminal green only for selection and active flows.
5. Give map surfaces the approved Zoetrope-like terminal finish: compact titled frames, clean observed edges, distinct planned/missing strokes, quiet terminal-derived fills, rounded actor/external cards, and clear nested container/group boundaries.
6. Remove the obsolete TUI ELK/semantic projection code and tests once the SheetScene path owns the supported flow. Keep hierarchy, details, search, work and flow behavior over the architecture graph, grouped by their TUI domains.
7. Verify pure scope, projection, route promotion, camera and lifecycle behavior with concurrent fixture tests. Then use tui-test on the real Groma world at 120x36 and 200x60, rejecting frames unless the root and container maps visibly match the approved composition and Zoetrope-like edge/arrow quality.

8. Make Escape dismiss the optional details pane and return focus to the map, document the key, and verify the reducer plus the real 120x36 TUI without changing web behavior.

9. Animate only active-flow routes with a source-to-target marching pattern on a 120 ms presentation clock. Keep route points, arrowheads, labels, camera, and sheet immutable; stop the clock when no flow is active or the viewer closes; verify pure phase behavior, lifecycle cleanup, and consecutive tui-test frames.

10. Make directional navigation lane-aware: candidates overlapping the current card on the perpendicular axis rank before diagonal candidates, then the nearest candidate forward wins. Add a minimal two-row component-layout regression and verify Edit to Create to Edit plus Create down to Commands down to Instructions through tui-test.

11. Cache the terminal architecture model and composed sheet in the view host. Work reads update only projected work markers; source, Markdown, and manual refreshes remain the only paths that reload architecture and rebuild the sheet. Verify work updates, architecture refreshes, selection lifecycle, and delayed startup input with tui-test.

12. Make map navigation containment-aware: choose the nearest directional sibling first, then the visible parent boundary before crossing to an element outside that parent. Preserve lane ranking within each tier and verify vertical sibling and outward-boundary transitions with a minimum fixture and tui-test.

13. Treat selectable boundaries as one navigation step in either direction. Remember the previous map selection so an arrow from an outside element stops on the system, the next arrow enters its nearest same-lane child, and the reverse path stops on the system before leaving it. Make Escape leave container scope, close details, and return focus to the root map. Verify both directions and Escape with minimum state tests and tui-test.

14. Rank children reached through a boundary by the first edge encountered along the travel direction, then use the entry ray to break equal-edge ties. Verify the symmetric minimum fixture and the real Git Left to Groma Left to Core path without changing ordinary sibling navigation.

15. Prove boundary traversal as a four-direction invariant. Extend the minimum world with systems north and south of the selected system, then verify North Down to boundary Down to its top child and South Up to boundary Up to its bottom child alongside the existing horizontal paths.

16. Separate map selection from active-flow playback: keep selection visibly marked, mark the current leg's visible source and destination (including promoted component endpoints), keep exact endpoint names in the footer, and verify state plus real 120x36 flow frames without touching web or shared sheet code.

17. When a flow leg is active, reveal its visible destination with the existing minimal camera rule without changing architecture selection or map scope; verify the current target stays observable in root and container views.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Scope correction: placement and routing are being replaced in parallel for both viewers. TASK-169 therefore owns only the TUI scene contract, interaction and painting. Its temporary graph-to-scene adapter is isolated and intentionally minimal so the replacement can remove it without changing the UI.

Plan correction: keeping ELK is the smaller temporary choice. The earlier TerminalScene adapter proposal was unnecessary indirection and will not be implemented. TASK-169 consumes the existing ArchitectureWorld until the parallel placement replacement lands.

Implemented the final two-scope TUI directly over the existing ELK ArchitectureWorld. Removed fit-all zoom, zoom controls, camera animation, the intermediate TUI container level, optional hierarchy state, and the separate camera controller. Root and container scopes use one fixed scale with minimal selection panning; hierarchy, details, flows, search, work, and refresh remain integrated. Cold simplicity review findings were applied and its targeted re-review found no regression. Full-context architecture review found no authority-backed blocker and recommends keeping the current navigation/projection and atoms/molecules/organisms boundaries until the shared placement replacement settles. Verification: bun run check passed 95 Node tests and 178 viewer tests; final focused TUI suite passed 48 tests; tui-test captured root and container views at 120x36 and root at 200x60; + produced a byte-identical frame.

Late tui-test gap audit found a blocking rendered-frame issue: an outer selection border overwrote routes and selection-dependent relationship labels changed map cells even though the camera stayed fixed. This is within AC5 and the TUI map stability contract; fix before final approval.

Completed the missing end-to-end tui-test matrix. The first arrow-frame comparison caught a real paint-layer defect: an outer selection frame and selection-dependent labels changed map cells. Removed that overlay, kept selection as in-place terminal color, and restricted map labels to active flows; details retains all relationship text. Final tui-test evidence: 120x36 root with details open/closed; root-to-CLI container transition; Commands to Plain text view arrow changed details while the full map character region remained byte-identical; r refresh remained byte-identical; active container flow rendered green route cells and its label; / search selected Terminal viewer and synchronized the hierarchy; fresh 200x60 launch rendered 200 columns. Full bun run check passed 95 Node and 178 viewer tests. The repeated full-context complexity review found no blocker.

Reopened after direct product review. The committed root frame is not an acceptable visual result: it renders the internal system as a mostly empty oversized boundary, omits the visible container/group composition and useful external-system placement, and does not meet the approved Zoetrope-like box-and-arrow direction. Previous completion evidence over-weighted state invariants and did not establish visual completeness.

User constraint for the recovery: do not alter web behavior or dirty web files. Treat the current shared SheetScene producer as read-only; add only a terminal projection and TUI integration over its existing output.

Recovery implementation now consumes the same read-only SheetScene as web and deletes the obsolete semantic TUI projection. Root shows actor cards, the internal-system boundary with container slabs and collapsed group zones, and external systems; container scope shows group zones and component cards. Routes reuse sheet points, promote hidden endpoints, stay orthogonal, and use source ports plus directional arrowheads. Terminal-derived grayscale surface fills replaced noisy patterns; green remains the only map accent.

Verification after the cold simplicity review and its targeted re-review: `bun run check` passed 95 Node tests and 154 viewer tests; the focused TUI suite passed 26 tests; `git diff --check` passed for TASK-169 files. `tui-test` exercised the real `groma view` at 120x36 and 200x60, root and Terminal viewer component scope, details, search, arrow selection with byte-stable map characters, and active flow rendering. Final captures: `/tmp/groma-task169-final120.O3bB74/root.svg`, `/tmp/groma-task169-final200.k46UzS/root.svg`, and `/tmp/groma-task169-detail.p8daA2/components.svg`. No `src/viewers/web` or `src/sheet` file was changed by TASK-169.

Final visual QA moved boundary frames and titles above routes so edges cannot erase node labels. The post-change focused TUI suite passed 25/25 and typecheck passed. A subsequent full run passed all 95 Node tests and 153 viewer tests, while the unrelated web Markdown live-reload test timed out once under full-suite load; that web test passed alone in 218 ms. The complete 154-test viewer suite had passed immediately before this TUI-only paint-order change. Current review captures: `/tmp/groma-task169-final.24Kzh5/root.svg`, `/tmp/groma-task169-review.zjwHf2/root-120x36.svg`, and `/tmp/groma-task169-review.zjwHf2/components-120x36.svg`.

Added the requested Escape behavior: outside search, Escape now closes the optional details pane and returns focus to the architecture map; Backspace remains the only scope-back key and  still toggles details. Added a concurrent navigation-state test and updated the TUI key guide. Verification: 12 focused navigation/chrome/lifecycle tests passed, typecheck passed, and tui-test at 120x36 confirmed  disappears after Escape and the map expands into the released pane width. Evidence:  and . No web file changed.

Correction to the preceding note: the details toggle key is the right bracket key. tui-test confirmed the text "What it does" disappears after Escape. Evidence files are /tmp/groma-tui-esc-final.18J8sq/details-open.svg and /tmp/groma-tui-esc-final.18J8sq/details-closed.svg.

Added Zoetrope-style active-flow animation in the TUI only. A 120 ms presentation clock advances a two-cells-on, one-cell-gap pattern from source to target; route points, corners, labels, endpoints, arrowheads, camera, and the shared sheet stay fixed. The clock exists only while a flow is previewed or committed and is cleared with the flow or viewer lifecycle. Verification: 27 focused TUI tests and typecheck passed; tui-test at 120x36 captured changing active-route frames and byte-identical settled frames after x cleared the flow. Evidence: /tmp/groma-flow-animation-long.4nzHju/frame-1.svg, frame-2.svg, and settled-1.txt/settled-2.txt. Full check passed all 95 Node tests and 154 of 155 viewer tests; the unrelated web architecture live-reload test timed out under the full suite but passed alone in 216 ms. No web file was changed for this addition.

Fixed directional selection after reproducing the reported CLI layout. The previous squared-distance ranking chose Instructions from Create because it was only two cells to the right despite being nine cells below. Navigation now ranks perpendicular overlap first, so same-row and same-column peers win before diagonals, then chooses the nearest peer forward. Added a minimum two-row regression without product-specific content and documented the lane rule. Verification: 28 focused TUI tests, typecheck, and diff check passed. tui-test at 120x36 verified Edit left to Create right to Edit, then Create down to Commands down to Instructions. Evidence: /tmp/groma-lane-navigation-final.P94e6q/instructions.svg. No web file changed.

Removed the delayed startup input stall by caching the annotated graph and SheetScene in the terminal host. Backlog reads now update only work markers; source folds, Markdown changes, and manual refreshes still rebuild architecture. In three pre-fix runs an Escape sent 0.8 seconds after the first frame was delayed by up to 2.81 seconds; after the split it completed immediately in every run. The host, live-refresh, work, navigation, projection, camera, and lifecycle set passed 28 tests, and typecheck passed.

Made arrow selection containment-aware. It now chooses a same-lane directional sibling before the visible parent boundary, then considers remaining directional elements. The minimum fixture verifies lower child Up to upper sibling, Left to parent, then Left to the outside actor. tui-test on the real 120x36 Groma view confirmed Terminal viewer Up to CLI, Terminal viewer Left to Groma, and the next Left to Coding agent. Evidence: /tmp/groma-task169-nav4.XEZMkk/up.svg, /tmp/groma-task169-nav5.LZ3QnQ/left-system.svg, and /tmp/groma-task169-nav5.LZ3QnQ/left-outside.svg. No web source file changed.

Corrected the containment model after product review. Map arrows now remember the last crossed edge: Human architect Right stops on Groma, the next Right follows the same ray to Terminal viewer; Terminal viewer Left stops on Groma, and the next Left reaches Coding agent. Escape from component scope now returns to the root map, closes details, resets the scope camera, and focuses the map. Eighteen focused navigation, chrome, projection, and lifecycle tests plus typecheck passed. tui-test verified the exact 120x36 path and Escape result. Evidence: /tmp/groma-task169-boundary2.kXG4rE/right-system.svg, right-container.svg, container-open.svg, and escape-root.svg. No web source file changed.

Fixed right-side system entry. Boundary traversal now ranks direct children by the first edge encountered along the travel direction; only equal-edge candidates use the perpendicular entry ray. This preserves Human architect Right to Groma Right to Terminal viewer and changes Git Left to Groma Left from CLI to Core. Fourteen focused navigation, projection, and camera tests plus typecheck passed. tui-test verified the real 120x36 Git path. Evidence: /tmp/groma-task169-git.9cA0fu/left-system.svg and left-core.svg. No web source file changed.

Generalized directional navigation around one normalized forward axis. Left, right, up, and down now share the same edge, lane, and distance calculations instead of separate directional ranking. The minimum fixture proves all four boundary paths: west/east entries select the first horizontal child edge, north/down enters the top child, and south/up enters the bottom child. Fourteen focused navigation, projection, and camera tests plus typecheck passed. No web source file changed.

Separated architecture selection from flow playback. Flow-touched cards no longer reuse selection framing; an active leg keeps its animated route and adds a source marker plus a destination badge on the exact visible endpoint or its promoted ancestor. The footer and hierarchy-focused details show leg count, exact endpoints, and description; root breadcrumbs name hidden endpoints through their real visible ancestor. Stepping minimally reveals the destination without changing architecture selection or scope. The cold simplicity review found duplicated endpoint promotion; route attachment, camera attention, and markers now share projection.visibleEndpointFor, and the targeted re-review passed. Verification: bun run check passed 95 core and 153 viewer tests; focused projection/navigation/tree checks passed 17/17; tui-test at 120x36 verified the root destination badge and component-scope Screen badge with the independent Action path selection. Evidence: /tmp/groma-flow-final.CE5gjY/root-leg.svg and /tmp/groma-flow-final.CE5gjY/component-leg.svg. No web source or shared sheet file was changed for this slice.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Rebuilt groma view as the fixed-scale terminal projection of the shared architecture sheet: root and container scopes, stable hierarchy/details chrome, terminal-derived grayscale, Zoetrope-style routes and animation, containment-aware four-direction navigation, prompt startup, cached work refreshes, and distinct flow-leg destination markers. The final cold simplicity review consolidated route, camera, and marker endpoint promotion into one projection rule. Verification passed with 95 core tests and 153 viewer tests plus tui-test captures at 120x36 and 200x60, including root, container, details, search, stable arrow frames, refresh, active flows, Escape, and exact flow destinations. Web rendering and the shared sheet producer were not changed by the final TUI slices; TASK-169.1 remains the separate Work-focus follow-up.
<!-- SECTION:FINAL_SUMMARY:END -->
