---
id: TASK-255
title: Shape architecture through map gestures and shared editing operations
status: Done
assignee:
  - '@codex'
created_date: '2026-09-05 16:46'
updated_date: '2026-09-05 17:13'
labels: []
dependencies: []
references:
  - architecture-model
  - observed-curation
  - web-viewer-authoring
  - iso-map
  - iso-camera
  - authoring
documentation:
  - docs/component-markdown.md
  - docs/viewers/web/index.md
modified_files:
  - features/editing.feature
  - src/types.ts
  - src/architecture-markdown.ts
  - src/markdown-emitter.ts
  - src/relation.ts
  - src/core.ts
  - src/authoring.ts
  - src/cli.ts
  - src/viewers/web/data.ts
  - src/edit.ts
  - src/viewers/web/iso/style.ts
  - src/viewers/web/iso/paint-routes.ts
  - src/viewers/web/chrome/relate.ts
  - src/curate.ts
  - src/viewers/web/organisms/writes.ts
  - src/viewers/web/organisms/editable.ts
  - src/viewers/web/organisms/details.ts
  - src/viewers/web/authoring.ts
  - src/viewers/web/editing/intent.ts
  - src/viewers/web/editing/create.ts
  - src/viewers/web/editing/gestures.ts
  - src/viewers/web/render.ts
  - src/viewers/web/page.ts
  - test-bun/editing.test.ts
  - test/architecture-model.test.ts
  - test/edit.test.ts
  - test-bun/web-svg-performance.test.ts
  - src/plain-world.ts
  - docs/component-markdown.md
  - docs/viewers/web/index.md
  - docs/agent-instructions/index.md
  - src/instructions.ts
  - groma/systems/groma/containers/web-viewer/components/web-viewer-authoring.md
  - groma/systems/groma/containers/web-viewer/components/intent.md
  - groma/systems/groma/containers/web-viewer/components/create.md
  - groma/systems/groma/containers/web-viewer/components/gestures.md
  - groma/systems/groma/containers/cli/components/observed-curation.md
  - groma/systems/groma/containers/core/components/architecture-model.md
  - src/draft.ts
  - docs/product-model.md
type: feature
ordinal: 294000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
When an architect edits the live Groma map, they can draw around sibling components to group them, drag new system/container/component drafts into their architectural context, connect components with a draft relationship, and explicitly edit and save details with validation. Core owns every mutation and its rules, the CLI exposes every mutation, and the web translates gestures into those operations. Groma chooses all positions, group boundaries, and routes. Draft relationships have their own lifecycle even between observed endpoints; their fixed dashed styling remains distinct from flow animation. Preserve the existing current, historical, and static reading flows, and remove superseded editor controls and paths.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Core and CLI support creating, editing, removing, and explicitly accepting draft relationships independently of endpoint lifecycle; drawing a relationship never claims implemented code, and scans do not accept it.
- [x] #2 Drawing a boundary around sibling components creates a named group through the shared operation; core calculates the resulting group boundary and layout without storing gesture coordinates.
- [x] #3 Dragging a system, container, or component creation control onto a valid map context creates a draft of that kind with the correct parent; observed software remains scanner-owned and core calculates final positions.
- [x] #4 Dragging a directed connection between components collects its meaning and saves a draft relationship; cancel or validation failure makes no architecture change.
- [x] #5 An explicit Edit action switches element and relationship details from reading to editing, with Save at the bottom, Cancel, and shared validation; successful saves update the map and CLI view, and failed or cancelled edits preserve saved data.
- [x] #6 Draft elements and relationships retain their fixed dashed identity during selection and flow highlighting; flow traversal uses a separate directional motion treatment instead of animating the lifecycle dashes.
- [x] #7 Fixture-based product scenarios and focused tests verify authoring, draft lifecycle, gesture intent, and editing state; relevant docs and architecture are updated, real browser gestures are checked, and bun run check passes.
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
1. Define the supported editor scenarios and an explicit draft relationship in the linked Markdown profile. Reuse core authoring and CLI verbs for its create/edit/remove/accept lifecycle, preserving parallel flow work.
2. Replace per-field autosave with one scoped details editing session, shared form controls, Save/Cancel, and core validation. Keep authored fields separate from read-only source evidence and flow/task navigation.
3. Add one compact map editing tool strip. Creation drag resolves a valid parent; grouping gesture resolves sibling members; connection drag resolves directed endpoints. Submit the same core inputs as the CLI and let core compose all geometry.
4. Keep lifecycle strokes fixed and replace marching flow dashes with a separate directional marker. Integrate editor state with current/live capability and existing selection/camera lifecycle.
5. Run focused fixture-based authoring and interaction-state tests, exercise the actual browser gestures, update docs and architecture, and run bun run check. Perform cold simplicity review, own specification/quality reviews, and a full-context review; finalize and commit/push only task changes.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Implemented independent draft relationship tables with explicit CLI acceptance, scoped Save/Cancel details, ownership-only creation drops, rectangular group selection, directed connection gestures and fixed lifecycle strokes with separate flow markers. Browser verification found and fixed hidden-overflow map scrolling during toolbar focus. Reproduced Save validation failures for whitespace technology and a duplicate overview heading; proposed element Markdown now passes the normal architecture model before writing, including joint meaning/structure saves. Full check passed before this validation fix; focused authoring checks are rerun after it. Other task hunks are preserved in shared files.

Browser sequence verified system and container creation, grouping two sibling components, directed draft connection Cancel and Save, invalid relationship Save followed by correction, explicit relationship acceptance, and CLI reading the edited text. CSS inspection during an authored flow showed the draft line retained 4/3 dashes with no animation while the separate flow marker had motion. Found a further supported gesture failure: hollow draft containers had no interior pointer hit area; their faces now accept pointer hits without changing their hollow appearance.

Cold simplicity review passed. Applied its optional consolidation: MeaningChanges/withMeaning now owns field transformations for both plain edits and structural curation; targeted re-review passed. Implementer specification review maps all seven criteria to CLI/core tests, web interaction evidence, profile documentation and shared layout reuse. Quality review checked changed write paths, cancellation, validation order, live/published gating, hit testing, pointer ownership and fixed draft/flow styling. No authority-backed blocker remains in reviewed code. Browser retest confirmed drops work inside a hollow draft container.

The final check after simplification saw one intermittent existing web add/remove watcher read race (ENOENT after the test removed its actor); isolated web-authoring tests then passed 6/6 and a full rerun is in progress. No filesystem retry or recovery behavior was added. TUI fixture smoke verified the root map and container details, moved selection without changing core geometry, and captured 120x36 and 200x60 views.

Final full-context complexity review passed with no blocker or material architecture change recommended. It confirms clear gesture/form/shared-operation/model boundaries and recommends keeping this approach. Optional future naming only: editable.ts could be called edit-form.ts; no implementation pass is justified. Both separate reviews are complete.

Final full repository check passed after closing the temporary preview watcher: 104 Node tests and 301 Bun tests, zero failures (/tmp/groma255-check6.txt). All acceptance criteria are verified by the fixture lifecycle/authoring tests, direct CLI exercises, actual browser creation/group/connection gestures and editing checks, CSS motion inspection, and TUI smoke described above. Documentation and both required separate reviews are complete.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Implemented map creation, grouping and directed connection gestures through shared core/CLI operations, with Groma-owned layout. Details now use explicit Edit, Save and Cancel with validation before writes. Draft relationships have independent lifecycle and explicit acceptance; fixed draft strokes remain distinct from directional flow motion. Verified actual browser gestures, CLI lifecycle and TUI navigation, plus all 104 Node and 301 Bun tests. Cold simplicity, implementer specification/quality and full-context complexity reviews passed.
<!-- SECTION:FINAL_SUMMARY:END -->
