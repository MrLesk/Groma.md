---
id: TASK-325
title: 'Switch blueprint editor between isometric, 2D and layered maps'
status: In Progress
assignee:
  - '@chatgpt'
created_date: '2026-09-08 11:46'
updated_date: '2026-09-08 12:04'
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
- [ ] #1 A compact accessible Isometric / 2D / Layers selector switches the same current or drafted architecture without changing its data or losing inspector input.
- [ ] #2 2D renders flat axis-aligned footprints and readable labels, retaining participants, containment, planned relationships and source evidence.
- [ ] #3 F2 enters Layers and returns to the prior Isometric or 2D view; repeated switching preserves each view’s navigation context.
- [ ] #4 Pointer navigation remains usable in Isometric and 2D; Layers supports orbit and Shift-drag panning without accidental selection.
- [ ] #5 Domain and browser tests exercise switching during placement, preview, creation and current inspection; full repository checks and actual desktop/narrow screenshots are recorded.
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [ ] #1 Acceptance criteria have objective verification evidence.
- [ ] #2 Relevant checks pass and changes remain task-scoped.
- [ ] #3 Public contracts or documentation are updated when behavior changes.
- [ ] #4 Implementation Plan reflects the final approach; correction history and verification are recorded in Implementation Notes.
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
<!-- SECTION:NOTES:END -->
