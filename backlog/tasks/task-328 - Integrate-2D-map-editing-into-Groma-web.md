---
id: TASK-328
title: Integrate 2D map editing into Groma web
status: Done
assignee:
  - '@codex'
created_date: '2026-09-09 16:01'
updated_date: '2026-09-09 16:17'
labels:
  - web
dependencies: []
references:
  - 'https://github.com/MrLesk/Groma.md/tree/research/blueprint-store-prototype'
  - layer-modes
  - iso-projection
  - web-shell
  - page
  - render
  - map-view
  - presentation
documentation:
  - docs/viewers/web/index.md
  - docs/component-markdown.md
modified_files:
  - src/viewers/web/layers/orbit.ts
  - src/viewers/web/iso/presentation.ts
  - src/viewers/web/chrome/map-view.ts
  - src/viewers/web/page.ts
  - src/viewers/web/render.ts
  - test-bun/web-layer-mode.test.ts
  - test-bun/web-map-presentation.test.ts
  - docs/viewers/web/index.md
priority: high
type: feature
ordinal: 374000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
People editing architecture in groma web can switch instantly between isometric and overhead 2D views in the existing map workspace, and inspect Layers with F2. The existing live editor owns selection, draft meaning and Save/Cancel; camera presentation must preserve that state. Integrate the useful projection from research/blueprint-store-prototype into the current Groma architecture and shell. The blueprint catalogue and its separate fixture storage are outside this feature.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 The existing groma web map has visible Iso, 2D and Layers controls; switching to overhead 2D is immediate, and F2 returns from Layers to the previous nested view.
- [x] #2 All presentations use the same architecture and composed layout, preserving identities, containment, directed relationships, draft status and source evidence without changing stored knowledge.
- [x] #3 Current and draft elements and editable relationships remain selectable in the live map; the existing editor can save changes and cancel with Cancel or Escape while switching views preserves unfinished form values and selection.
- [x] #4 Changing view or inspecting another panel does not remove draft architecture from the map; the existing hierarchy and details controls leave the map usable.
- [x] #5 Camera fitting, pan, zoom and Layers orbit work in their supported views, with clear active controls and no new camera state coupled to authoring.
- [x] #6 Focused invariant tests, browser checks of the live editing flow and bun run check pass; required simplicity, specification, quality and full-context complexity reviews are recorded.
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
1. Reuse the live shell, selection and authoring; add native Iso/2D/Layers controls beside the existing camera controls.
2. Extend the existing presentation motion owner and project an overhead view from the same sheet without changing architecture, source evidence or forms.
3. Reuse selection fitting in nested views and whole-stack fitting in Layers; keep the header usable at the supported minimum width.
4. Verify projection/navigation invariants and the live Save/Cancel/Escape, draft and relationship flows; complete all required reviews and repository checks.
5. Update the web guide, then commit and push only this task’s files.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
The current live editor already supports element and relationship Save/Cancel and keeps forms during map-only updates. Integrate view selection into the existing Layers motion owner, add a pure overhead projection and a compact native radio control in the existing header. No separate authoring model, catalogue, storage or architecture metadata is needed. View changes use the existing camera fitting rules; only the projection changes.

Focused verification found the new multi-floor test lacked a second observed component for the existing relative file-count scale. Added the minimum one-file comparison component, preserving the multi-floor assertion. Type checking and focused lint passed.

Browser checks verified saved component meaning in Markdown, Cancel across view changes, Escape while F2 is active, and live draft selection. The browser also showed whole-map refitting made the active edit unreadable after a mode change. Nested views now use the existing fitArchitecture rule for the current architecture selection; Layers still shows the whole stack. This adds no camera cache or editor state.

Cold simplicity review passed with no blockers. Accepted its only optional recommendation: removed the new exact pan arithmetic assertion already covered by iso-map.test.ts; retained presentation switching, shared pan/zoom execution and finite-coordinate checks.

At the supported 900px minimum width, the added view controls exposed a header collision between Revision and Search. The existing narrow-header breakpoint now reduces Revision to its labelled icon, alongside the existing Fit and Theme label reductions. The revision menu and tooltip remain available.

Implementer specification review: AC1 verified with native controls and F2 in the browser; AC2 verified by projection immutability, identity/route/source-file tests; AC3 verified current component Save plus Cancel and Escape, draft Save, and relationship Save across Iso/2D/Layers using the real live backend and reading resulting Markdown; AC4 verified actual map click selects the draft and Help leaves its rendered node present; AC5 verified Fit, zoom, drag-pan, keyboard radio navigation and Layers orbit. At 900px the corrected header has no overlap. AC6 awaits the final full-context review. Implementer quality review found no remaining blocking defect: authoring and stored knowledge are unchanged, map updates retain forms, new functions pass cognitive-complexity lint and all changed source/test files stay within 500 lines. Latest bun run check passed: 110 Node tests; 402 Bun tests passed, 7 existing optional-tooling tests skipped, 0 failed. git diff --check passed. Browser console has no warnings or errors.

Final full-context complexity review passed with no blockers or material architecture recommendations. It confirmed one presentation owner, one architecture model, one authoring path, clear domain grouping, and existing selection fitting as the simplest approach. Applied its only non-blocking cleanup: the web guide now describes projection in the selected view. Final browser evidence is /tmp/groma-task-328-evidence/2d-editor.png; the running preview at http://localhost:8878 uses a disposable copy of test/fixtures/plain-view with the real web server and writers.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Integrated Iso, overhead 2D and Layers controls into the existing Groma web editor. Overhead switches are immediate; F2 returns to the previous nested view, and selected architecture stays readable. Selection, drafts, relationships and unfinished forms retain their existing ownership and writing path. Corrected compact-header layout and documented the behavior. Verified real browser editing and stored Markdown, projection/navigation invariants, cold simplicity and full-context reviews, and bun run check: 110 Node tests and 402 Bun tests passed, 7 tooling-dependent tests skipped, zero failures.
<!-- SECTION:FINAL_SUMMARY:END -->
