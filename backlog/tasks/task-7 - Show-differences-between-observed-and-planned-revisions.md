---
id: TASK-7
title: Show differences between observed and planned revisions
status: Done
assignee:
  - '@codex'
created_date: '2026-07-27 20:55'
updated_date: '2026-07-27 23:00'
labels: []
milestone: m-1
dependencies:
  - TASK-6
references:
  - README.md
  - groma/plans/02-live-viewer/README.md
modified_files:
  - README.md
  - e2e/viewer.spec.js
  - src/architecture-comparison.mjs
  - src/viewer/projection.mjs
  - src/viewer/server.mjs
  - src/viewer/styles.css
  - src/viewer/viewer-app.jsx
  - test/viewer-projection.test.mjs
priority: high
type: feature
ordinal: 7000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Groma plans are complete desired architecture snapshots under groma/plans/<revision>, while groma/observed is the current materialized snapshot. Extend the viewer from TASK-6 to compare one selected plan with observed architecture by stable element ID. The comparison is a disposable projection: it reads both directories, classifies differences, and never modifies either set of Markdown files.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 An element present only in the selected plan is classified and drawn as a ghost addition
- [x] #2 An element with the same stable ID but different architecture content is classified and drawn as a planned modification
- [x] #3 An element present only in groma/observed is classified and drawn as a planned removal
- [x] #4 An element with equivalent architecture content in both snapshots remains visible without change emphasis
- [x] #5 Comparison works at system, container, and component views and never writes to either revision
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. Add red synthetic projection regressions for addition, modification, removal, and unchanged classifications across system, container, and component views; prove filename/revision/runtime metadata do not affect equivalence.
2. Implement a deterministic, pure comparison projection keyed by stable ID. Canonical architecture content is element kind, name, description, parent ID, external flag, and sorted outgoing relationship target/description/technology tuples; source paths, revision identity, and presentation/runtime state are excluded.
3. Merge planned and observed models for C4 projection: prefer planned content for shared IDs, retain observed-only elements and relationships so removals preserve their original containment, and annotate projected element/boundary data with comparison status.
4. Load observed and the selected plan in parallel at viewer startup, expose a read-only comparison payload, and retain the existing explicit plan selection without scanning or live reload.
5. Extend the drafting-table UI with accessible addition/modification/removal treatments and a compact comparison legend while leaving unchanged elements visually neutral.
6. Add browser assertions for comparison state at system, container, and component levels, then verify unit/architecture checks, Bun production build, browser flows, groma immutability, scoped diff, and Backlog criteria before committing main.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Implemented a pure stable-ID comparison projection. Architecture equivalence is deterministic: kind, name, description, parent ID, external flag, and sorted outgoing target/description/technology tuples are compared; revision identity, source/target filenames, input ordering, and presentation/runtime fields are ignored. Shared IDs project planned content; plan-only and observed-only elements retain their own C4 containment, and relationships from both snapshots keep connected context visible.

UI direction extends the existing drafting table with green translucent/dashed ghost additions, amber modification outlines, red hatched/dashed removals, neutral unchanged elements, visible badges, and an accessible comparison key. The server loads observed plus the selected plan concurrently and exposes GET-only comparison data; no scanning, reload, or Markdown write path was added.

Evidence: synthetic projection regressions cover all four states at system, container, and component levels, relationship-content changes, metadata equivalence, deterministic ordering, purity, and both-side containment. npm run check validated 4 revisions and passed 55/55 tests. npm run test:viewer:browser passed 2/2 flows, including exact comparison state and visible badge assertions across context/container/component at 1440x960 and 390x844, Plan 03 sibling navigation, screenshots, focus/geometry checks, and zero console/page errors. Bun production build bundled 147 modules. git diff --check passed and git diff --exit-code -- groma/ proved neither revision changed.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Added a read-only observed-versus-selected-plan projection keyed by stable element ID, with deterministic architecture-content equivalence, unioned C4 containment, and distinct accessible treatments for additions, modifications, removals, and unchanged elements. Verified all states synthetically across three C4 levels, real desktop/mobile browser flows, 55/55 repository tests, 2/2 Playwright tests, a successful Bun build, and no groma/ changes.
<!-- SECTION:FINAL_SUMMARY:END -->
