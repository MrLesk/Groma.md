---
id: TASK-7
title: Show differences between observed and planned revisions
status: Done
assignee:
  - '@codex'
created_date: '2026-07-27 20:55'
updated_date: '2026-07-27 23:14'
labels: []
milestone: m-1
dependencies:
  - TASK-6
references:
  - README.md
  - groma/plans/02-live-viewer/README.md
modified_files:
  - README.md
  - e2e/comparison-fixture-server.mjs
  - e2e/viewer.spec.js
  - playwright.config.mjs
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

7. Add a red pure geometry regression with a four-state union of at least four containers and enough components to overflow both fixed boundaries; assert every child rectangle fits its parent and peer rectangles are disjoint.

8. Add a test-only temporary Markdown repository runner and guarded server-root hook, then add a red Playwright flow that renders all four comparison states, checks browser geometry for non-overlap, and opens every union container.

9. Replace fixed container/component boundary heights with deterministic count-aware geometry while preserving the existing columns, peer parentage, fit behavior, and interaction contract.

10. Verify the synthetic browser flow, the existing desktop/mobile and Plan 03 flows, full repository checks, Bun build, clean diff, and no canonical groma changes; inspect screenshots before refinalizing and committing.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Implemented a pure stable-ID comparison projection. Architecture equivalence is deterministic: kind, name, description, parent ID, external flag, and sorted outgoing target/description/technology tuples are compared; revision identity, source/target filenames, input ordering, and presentation/runtime fields are ignored. Shared IDs project planned content; plan-only and observed-only elements retain their own C4 containment, and relationships from both snapshots keep connected context visible.

UI direction extends the existing drafting table with green translucent/dashed ghost additions, amber modification outlines, red hatched/dashed removals, neutral unchanged elements, visible badges, and an accessible comparison key. The server loads observed plus the selected plan concurrently and exposes GET-only comparison data; no scanning, reload, or Markdown write path was added.

Evidence: synthetic projection regressions cover all four states at system, container, and component levels, relationship-content changes, metadata equivalence, deterministic ordering, purity, and both-side containment. npm run check validated 4 revisions and passed 55/55 tests. npm run test:viewer:browser passed 2/2 flows, including exact comparison state and visible badge assertions across context/container/component at 1440x960 and 390x844, Plan 03 sibling navigation, screenshots, focus/geometry checks, and zero console/page errors. Bun production build bundled 147 modules. git diff --check passed and git diff --exit-code -- groma/ proved neither revision changed.

Spec review reopened TASK-7: the container and component projections use fixed boundary dimensions while stacking a union of planned and observed children. With four or more containers, later nodes exceed the system boundary and React Flow extent clamping collapses them into overlapping positions, blocking distinct comparison states and interaction. Acceptance remains pending a count-aware layout plus pure geometry and real-browser fixture evidence.

Correction completed with red/green evidence. The root cause was fixed boundary geometry: container children used a 220px vertical step inside a 610px system boundary, so the third and fourth union containers ended at 735px and 955px; React Flow then clamped them into collisions. Component rows and sibling containers had the same fixed-height risk. Projection now derives system/container boundary heights from deterministic node dimensions, row/peer counts, spacing, and bottom padding while retaining the existing columns and C4 parentage.

The synthetic projection fixture now contains four union containers spanning addition, modification, removal, and unchanged, plus seven components. Its geometry regression failed before the fix and now proves all container/component children fit their parent and sibling peers remain disjoint. A test-only temporary Markdown repository runner and NODE_ENV=test-guarded server root feed the real viewer without touching canonical groma/. The Playwright regression failed before the fix with three collision pairs, then passed after the fix while asserting all four statuses, DOM non-overlap, and successful navigation into every container.

Fresh correction verification: npm run check validated all 4 canonical revisions and passed 56/56 tests; npm run test:viewer:browser passed 3/3 flows covering the four-state fixture, Revision 02 desktop/mobile readability, and Plan 03 sibling navigation; Bun bundled 147 modules successfully; git diff --check passed; git diff --exit-code -- groma/ was empty. The in-app Browser connection was attempted first but returned “No browser is available” with an empty browser inventory, so the committed Playwright fallback supplied DOM, interaction, console, and screenshot evidence. Visual inspection confirmed four distinct peers and readable state treatments.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Added stable-ID observed-versus-plan comparison and corrected union layout sizing so arbitrary container peers and component rows remain inside count-aware C4 boundaries instead of being clamped into overlap. Verified all four states synthetically and in a temporary-repository browser fixture, every fixture container clickable, 56/56 tests, 3/3 Playwright flows including mobile, a successful Bun build, and no canonical groma/ changes.
<!-- SECTION:FINAL_SUMMARY:END -->
