---
id: TASK-524
title: >-
  Move the camera frame into its own chrome file and split the web map
  orchestrator
status: Done
assignee:
  - '@claude'
created_date: '2026-09-24 18:38'
updated_date: '2026-09-24 18:51'
labels: []
dependencies: []
references:
  - shell
  - search-control
  - organisms-hierarchy
  - camera
  - render
modified_files:
  - src/viewers/web/chrome/frame.ts
  - src/viewers/web/chrome/shell.ts
  - src/viewers/web/search/session.ts
  - test-bun/web-frame.test.ts
  - test-bun/web-shell.test.ts
  - src/viewers/web/organisms/hierarchy.ts
  - src/viewers/web/iso/camera/session.ts
  - src/viewers/web/render.ts
  - groma/systems/groma-md/containers/export/components/organisms-hierarchy.md
  - groma/relationships.md
  - groma/systems/groma-md/containers/export/components/shell.md
  - groma/systems/groma-md/containers/export/components/camera.md
type: task
ordinal: 609000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
The TASK-523 end-of-task review found two structural follow-ups in the web map. chrome/shell.ts mixes shell visibility with the camera frame (mapFrame, measureFrame and their types) and imports the empty-state card only for that frame, so the frame is hard to find by domain. render.ts, the browser orchestrator, sits at 499 lines against the repository's 500-line limit, so the next change there would have to squeeze lines instead of adding behavior. Alex asked to do both now, without changing behavior.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 The camera frame (mapFrame, measureFrame and the rectangle types they use) lives in its own chrome file that owns the safe area left by visible chrome; chrome/shell.ts keeps only shell visibility and page hosts
- [x] #2 render.ts is split by domain so every web viewer source file stays within 500 lines, and each extracted piece has one clear owner
- [x] #3 Behavior is unchanged: bun run check passes, and the browser map still fits, selects, opens flows and tasks, searches and updates live as before
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
1. Move Rect, MapFrame, measureFrame and mapFrame from chrome/shell.ts into chrome/frame.ts (Map controls); measureFrame takes the FrameHosts it reads, so frame.ts does not depend on shell.ts. Move their tests into test-bun/web-frame.test.ts.
2. Move the hierarchy tree expansion state (tree, paintTree, toggleRow) into organisms/hierarchy.ts as createHierarchy with paint and reset.
3. Move the camera fit and zoom state out of render.ts into iso/camera/session.ts (Camera control): fitted, touched, the animator, paint, refit, refitTo, zoomBy, zoomAt, panBy, focus and the resize refit. The session exposes the animator methods, so camera call sites stay the same.
4. Fold the new files into their components with groma edit --combine and note the camera frame in the Map controls overview.
5. Verify with bun run check in a clean worktree and a browser smoke test of an exported map. No new tests: the refactor preserves behavior and the moved mapFrame tests keep their assertions.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
render.ts went from 499 to 446 lines. chrome/shell.ts keeps shell visibility, page hosts and the details CSS; chrome/frame.ts owns the camera frame and is the only chrome file that reads the welcome card. iso/camera/session.ts owns the camera for the page, so the touched rule (no live refits after the viewer moves the camera) and the resize behaviour live beside fit and zoom. organisms/hierarchy.ts keeps which branches are open and resets them for another revision.

Architecture: the running groma web watcher gave frame.ts and session.ts singleton components; groma edit shell --combine frame and groma edit camera --combine session folded them into Map controls and Camera control. The watcher also updated the Architecture tree entry symbol to createHierarchy and two derived callback rows in relationships.md; the Map controls overview now names the camera frame.

Verification: bun run check in a detached worktree at HEAD f2d7c4b8 plus only this change: Biome no errors (3 existing warnings), tsc clean, Node 16/16, Bun 741 pass, 48 skip, 0 fail. The shared tree fails two web-startup tests because of another session uncommitted scanner registry work; they pass in the clean worktree. Browser smoke test on an export built from this change: first fit with the system selected, tree expand kept across repaints, tree selection focuses the camera (82% to 237%), zoom in, Fit back to 100%, F1 refits and restores, a flow focuses its steps, Escape clears selection and details, no console errors. Search could not be driven end to end with synthetic input in the browser pane; the published site on the pre-refactor code behaves the same, and the search change here is the same touched state read and written through camera.touched.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Moved the camera frame (mapFrame, measureFrame and their types) from chrome/shell.ts into chrome/frame.ts, so shell.ts keeps shell visibility and page hosts and no longer reads the welcome card. Split the web map orchestrator: the camera fit, touched rule, animator, zoom steps, focus and resize refit now live in iso/camera/session.ts, and the hierarchy tree keeps its open branches in organisms/hierarchy.ts. render.ts went from 499 to 446 lines; every web viewer file is within 500. The new files joined Map controls and Camera control. Behavior is unchanged: bun run check passed in a clean worktree, and a browser smoke test of an exported map covered fit, tree expand and select, zoom, Fit, F1, flows and Escape.
<!-- SECTION:FINAL_SUMMARY:END -->
