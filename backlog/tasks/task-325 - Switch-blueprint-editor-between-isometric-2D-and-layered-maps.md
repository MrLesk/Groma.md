---
id: TASK-325
title: 'Switch blueprint editor between isometric, 2D and layered maps'
status: Done
assignee:
  - '@chatgpt'
created_date: '2026-09-08 11:46'
updated_date: '2026-09-08 12:12'
labels: []
dependencies: []
modified_files:
  - research/blueprints/map-views.feature
  - research/blueprints/map-projection.ts
  - research/blueprints/view.ts
  - research/blueprints/map-controls.ts
  - research/blueprints/app.ts
  - research/blueprints/style.css
  - test-bun/blueprint-map-views.test.ts
  - research/blueprints/map_capture.py
  - research/blueprints/capture.py
  - research/blueprints/verify.py
  - research/blueprints/MAP-VIEWS.md
  - research/blueprints/README.md
  - .github/workflows/blueprint-research.yml
  - research/blueprints/evidence/research-lint.log
  - research/blueprints/evidence/research-types.log
  - research/blueprints/evidence/domain-tests.log
  - research/blueprints/evidence/repository-check.log
  - research/blueprints/evidence/build.log
  - research/blueprints/evidence/01-library-light.png
  - research/blueprints/evidence/02-paste-dark.png
  - research/blueprints/evidence/03-bind-missing.png
  - research/blueprints/evidence/04-preview-blueprint.png
  - research/blueprints/evidence/05-created-dark.png
  - research/blueprints/evidence/06-overlapping-drafts.png
  - research/blueprints/evidence/07-invalid-paste.png
  - research/blueprints/evidence/08-stale-preview.png
  - research/blueprints/evidence/09-mobile-draft.png
  - research/blueprints/evidence/10-plan-preview-light.png
  - research/blueprints/evidence/11-iso-preview-light.png
  - research/blueprints/evidence/12-layers-preview-light.png
  - research/blueprints/evidence/13-selected-plan-dark.png
  - research/blueprints/evidence/14-mobile-plan-inspector.png
  - research/blueprints/evidence/15-mobile-plan-map.png
  - research/blueprints/evidence/browser-results.json
  - research/blueprints/evidence/browser-tests.log
  - research/blueprints/evidence/checks.json
type: feature
ordinal: 362000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Blueprint placement needs an unobscured top-down editing view without replacing Groma’s isometric or F2 inspection views. Add a compact view selector to the existing research editor, keeping one architectural sheet and preserving the active placement, bindings, selection and text input across switches. This task changes the research prototype, not production authoring contracts or dragging semantics.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 A compact accessible Isometric / 2D / Layers selector switches the same current or drafted architecture without changing its data or losing inspector input.
- [x] #2 2D renders flat axis-aligned footprints and readable labels, retaining participants, containment, planned relationships and source evidence.
- [x] #3 F2 enters Layers and returns to the prior Isometric or 2D view; repeated switching preserves each view’s navigation context.
- [x] #4 Pointer navigation remains usable in Isometric and 2D; Layers supports orbit and Shift-drag panning without accidental selection.
- [x] #5 Domain and browser tests exercise switching during placement, preview, creation and current inspection; full repository checks and actual desktop/narrow screenshots are recorded.
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
1. Reuse Groma’s sheet and projector; derive a flat top-down presentation without changing semantic rectangles or IDs.
2. Keep view selection and cameras separate from editor state; add native radio controls and F2 return-to-previous behavior.
3. Reuse pointer and orbit semantics, retain per-view camera and make Fit explicit.
4. Verify geometry/state invariants and browser interactions; capture real screens and document actual limits.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Local validation: 13 map-view tests pass (70 assertions); research lint/types and full repository check pass (110 Node + 398 Bun tests). Browser navigation to localhost is policy-blocked in this container; real browser tests/captures run through the branch workflow.

Recorded the actual check results and map-view browser captures from GitHub run 34223823317. See evidence/checks.json for the tested source and exit codes.

Recorded the actual check results and map-view browser captures from GitHub run 34224386965. See evidence/checks.json for the tested source and exit codes.

Verified application 2dc60097831a5a1595b52ef459cb19557a13add1 in GitHub Actions run 34224386965: dedicated lint/types passed; 43 domain tests (135 assertions), including 13 map tests; full repository check passed 110 Node + 398 Bun tests; 117 browser assertions passed (81 new mode-flow checks across three engines plus 36 existing blueprint checks). All six new screens inspected. Visual review found an inaccurate Current architecture map label during current-component inspection inside an unsaved preview; shared work-mode resolution now retains the preview label and geometry, and the corrected state was recaptured. The scope comparison against 07e14da contains only research implementation/docs/evidence, one new test, workflow and this task. Production source, architecture Markdown, scanners, fixture definitions and the existing TASK-324 record are unchanged. Implementer scope and quality review completed; no human usability study, physical-device validation or independent-agent review is claimed.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Added compact Iso / 2D / Layers controls to the existing blueprint research editor, using one shared sheet and independent view cameras. F2 returns to the previous nested view; selection, unsaved placement and inspector input survive switches. Isometric/2D pan and Layers orbit remain usable. Verified source 2dc6009 with full repository checks, 43 domain tests and 117 browser assertions; six new actual screens captured and inspected. Production Groma remains unchanged.
<!-- SECTION:FINAL_SUMMARY:END -->
