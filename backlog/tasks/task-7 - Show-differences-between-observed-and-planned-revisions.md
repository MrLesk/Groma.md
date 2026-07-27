---
id: TASK-7
title: Show differences between observed and planned revisions
status: Done
assignee:
  - '@codex'
created_date: '2026-07-27 20:55'
updated_date: '2026-07-27 23:25'
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
  - test/architecture-comparison.test.mjs
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

11. Add red model tests requiring observedParentId/plannedParentId and deterministic relationship provenance: exact directed endpoint/content matches unchanged, remaining rows on the same directed endpoint pair modifications, and endpoint/direction changes removals plus additions.

12. Add red projection tests for containers moving into/out of the focal system and components moving between containers; require union membership in both relevant views, valid current React Flow parents, and resolved human move descriptions.

13. Extend the temporary browser fixture with container and component moves plus changed/removed/added relationships; add red DOM assertions for visible move intent, status-bearing expandable names, interpretable accessible relationship labels, and computed modification-badge contrast >= 4.5:1.

14. Implement dual-containment comparison/projection, provenance-aware relationship contributions, accessible node/change descriptions, and a documented high-contrast modification token without changing canonical models or adding writes/watchers.

15. Re-run synthetic model/projection checks, full desktop/mobile/move browser flows, Bun build, canonical groma hashes/diff, Backlog finalization, and direct commit.
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

Quality review reopened TASK-7. Shared-element comparison currently copies only planned parentId, so moves can vanish from the observed containment view; relationship union strips observed/planned provenance; expandable accessible names omit comparison state; and the small modification badge token lacks an objective 4.5:1 contrast guarantee. Acceptance remains pending dual-containment projection, relationship-state labels, accessible change/move intent, and contrast evidence.

Final quality correction completed with red/green evidence. Shared elements now preserve observedParentId and plannedParentId plus resolved parent names, and union projection makes moved containers visible in both old/new system views and moved components visible in both container views while assigning valid current React Flow parents. Relationships are deterministically classified by directed endpoints and exact content: exact matches are unchanged, same-endpoint replacements are modifications with observed/planned provenance, and endpoint or direction changes are removals plus additions. Visible and accessible edge labels include state, description, technology, and direction context. Expandable accessible names include addition/modification/removal/unchanged status and move intent. The modification token is #75420e, documented at 7.18:1 against paper and verified from computed browser styles at >=4.5:1.\n\nFresh verification: npm run check validated 4 canonical revisions and passed 61/61 tests; npm run test:viewer:browser passed 3/3 desktop/mobile, Plan 03, and six-container comparison flows with zero console/page errors; Bun production build bundled 140 modules; git diff --check passed; git diff --exit-code -- groma/ was empty; canonical groma hash remained 2b3a7934275b7c19b25b7edf2c2cc55246d279106df4b0f02ed30a7769ebe53c. A rendered 1440x1000 fixture screenshot was inspected and showed distinct unclipped nodes, move text, and interpretable relationship labels. The in-app Browser remained unavailable, so the committed Playwright fallback supplied interaction, DOM, accessibility, computed-style, console, and screenshot evidence.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Implemented a read-only observed-versus-plan comparison across system, container, and component views. The final projection preserves both containment histories for moves, classifies relationship changes with deterministic observed/planned provenance, exposes status and move intent visually and accessibly, retains count-aware non-overlapping union layouts, and uses an objectively contrast-safe modification token. Verified by 61 unit/architecture tests, 3 browser flows, a successful Bun production build, screenshot inspection, and unchanged canonical groma content/hash.
<!-- SECTION:FINAL_SUMMARY:END -->
