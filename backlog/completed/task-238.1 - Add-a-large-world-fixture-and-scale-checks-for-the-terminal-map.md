---
id: TASK-238.1
title: Add a large-world fixture and scale checks for the terminal map
status: Done
assignee:
  - '@claude'
created_date: '2026-09-02 06:22'
updated_date: '2026-09-02 21:38'
labels:
  - tui
dependencies: []
references:
  - projection
  - viewer-semantics
  - terminal-painting
modified_files:
  - scripts/large-world-fixture.ts
  - test/fixtures/large-world
  - test-bun/helpers.ts
  - test-bun/large-world.test.ts
  - src/viewers/action-path.ts
  - src/viewers/tui/projection-camera.ts
  - src/viewers/tui/organisms/world.ts
parent_task_id: TASK-238
priority: high
type: chore
ordinal: 261000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
The terminal map has no fixture larger than 18 documents, so nothing proves it stays usable on a massive world. This task adds the large world every later facelift task is checked against. When a developer runs the terminal map tests, Groma proves arrow reachability, viewport-only painting and the repaint budget on a world of at least 4 systems, 20 containers, 300 components and 500 relationships loaded from test/fixtures.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 A fixture under test/fixtures holds at least 4 systems, 20 containers, 300 components and 500 relationships, and a checked-in script regenerates it deterministically
- [x] #2 A test proves every element of the root map and of every container map is reachable from the first selection by arrow keys alone
- [x] #3 A test measures one full repaint at 200x60 on that fixture and fails above 16 ms
- [x] #4 Only what touches the viewport is painted: the painter skips off-screen items and routes, and a test proves it on that fixture
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
1. Write scripts/large-world-fixture.ts: a deterministic generator exporting writeLargeWorld(root) that writes test/fixtures/large-world (4 systems, 20 containers, 300 components, 572 relationships, 2 actors, 1 external system, groups inside containers) in the OKF record format the other fixtures use. 2. Load the fixture through loadAnnotatedArchitecture plus sheetScene and measure composition and repaint. 3. Make the repaint budget hold: memoise worldCommands per relationship set (it walked the world on every paint) and add paintedWorld in organisms/world.ts so the painter draws only items and routes that touch the viewport. 4. Add test-bun/large-world.test.ts: fixture counts and generator determinism; arrow reachability of every root and container anchor through reduceViewer; one repaint at 200x60 under 16 ms on a mounted test renderer; paintedWorld keeps only what touches the viewport. 5. Run the focused tests and bun run check, then the review rounds.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Fixture: scripts/large-world-fixture.ts writes test/fixtures/large-world deterministically: 2 actors, 4 systems, 20 containers, 300 components, 1 external system, 572 relationships, 332 files. Finding: 20 same-offset cross-system routes (component 1 of each container into component 3 of the container seven places on) make Core's routeAll throw its shared-path safety error (shared=0.197; even 4 such routes leave 0.066), so the fixture keeps cross-system links to the container chain and the actor and external links. Sheet composition takes about 3.6 s for the world; the test file loads the immutable model once.

Repaint budget: one repaint at 200x60 took 168 ms, all in JavaScript: worldCommands walked the whole world per actor target on every paint (and on every keypress through detailsCommands and travelledBy). It is now memoised per relationship set (WeakMap on world.relationships, which survives work-only view model updates). Projection now keeps only items whose cells intersect the viewport and routes with a segment crossing it (routeTouches), so the painter never visits off-screen items or route cells. Two tests that compared item lists across viewports or cameras now compare the items both views show against the laid-out world bounds.

Cold simplicity review: no blocking findings. Accepted: the viewport cull moved out of projectWorld into one painter helper, paintedWorld in organisms/world.ts, because flow and work code read projection.items as the items shown at this level, not as what the camera shows; the projection and its two tests are back to their originals. Also accepted: canEnter instead of a restated rule, no LARGE_WORLD export, one containers-per-system constant, no trailing space after code:, a comment on the cache key and on the BFS key. Acceptance criterion 4 was reworded from cells to items and routes: a route crossing the viewport is still walked end to end and clipped by the scissor rect.

Full-context review: no material architecture recommendation except the scan watcher having turned scripts/large-world-fixture.ts into a zero-dependency component under Scanner; that record is left uncommitted for Alex to decide (exclude test support from the scan or fold it into an existing component). Accepted code points: the commands cache is keyed on the elements array then the relationships array, so a world that replaces either recomputes; the generator lost a dead branch and its duplicate system titles; the reachability walk asserts that an arrow never changes scope; routeTouches has its own two-shape test. Repaint measured 1 to 5 ms on the large world after the change; sheet composition (4 s) is Core's cost, outside this task.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Added the large-world yardstick: scripts/large-world-fixture.ts deterministically writes test/fixtures/large-world (4 systems, 20 containers, 300 components, 572 relationships), and test-bun/large-world.test.ts proves fixture size and determinism, arrow reachability of every root and container anchor, one repaint at 200x60 under 16 ms, and painter culling to the viewport. Making the budget hold on the current TUI: worldCommands is cached per world (it walked the world on every paint, 168 ms) and paintedWorld skips off-screen items and routes. Verified by bun test (4 pass) and bun run check (91 Node, 217 Bun, lint warnings unchanged at 28). Follow-ups for Alex: Core's sheet router throws its shared-path safety error when 20 same-offset cross-system routes are added; the scanner records the generator as a Scanner component.
<!-- SECTION:FINAL_SUMMARY:END -->
