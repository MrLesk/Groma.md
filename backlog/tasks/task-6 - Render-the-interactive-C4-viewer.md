---
id: TASK-6
title: Render the interactive C4 viewer
status: Done
assignee:
  - '@codex'
created_date: '2026-07-27 20:55'
updated_date: '2026-07-27 22:40'
labels: []
milestone: m-1
dependencies:
  - TASK-5
references:
  - README.md
  - groma/plans/02-live-viewer/README.md
  - 'https://c4model.com/'
  - 'https://reactflow.dev/'
modified_files:
  - README.md
  - package.json
  - package-lock.json
  - playwright.config.mjs
  - e2e/viewer.spec.js
  - src/viewer/index.html
  - src/viewer/main.jsx
  - src/viewer/projection.mjs
  - src/viewer/server.mjs
  - src/viewer/styles.css
  - src/viewer/viewer-app.jsx
  - test/viewer-projection.test.mjs
priority: high
type: feature
ordinal: 6000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Create Groma’s first read-only local viewer from the C4 model delivered by TASK-5. The opening system-context view shows users and neighboring systems; selecting the focal Groma system reveals its runtime containers; selecting a container reveals its components. The Revision 02 architecture snapshot specifies a Bun-served React interface using React Flow for the node-and-edge canvas. This task renders one selected revision only; observed-versus-plan comparison and live reload are separate dependent tasks.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 The opening view shows people, the focal software system, connected external systems, and labeled directed relationships
- [x] #2 Selecting the focal system replaces its single node with its containers while preserving connected context
- [x] #3 Selecting a container reveals its components while collaborating containers and systems remain peers rather than becoming children
- [x] #4 A user can return to the previous C4 level without changing any Markdown
- [x] #5 The viewer persists no layout, focus, selection, or interaction state into groma/
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. Add focused projection tests that define the three C4 levels, promotion of relationships to visible ancestors, peer preservation, and an in-memory-only focus contract.
2. Implement a pure viewer projection over TASK-5’s model with deterministic runtime layout coordinates and labeled directed edges; keep the domain model untouched.
3. Add a Bun-served, single-revision React + React Flow interface with custom C4 nodes, selected-focus expansion, breadcrumb/back navigation, and no write path.
4. Apply the “architect’s drafting table” direction: warm paper canvas, ink-blue structure, vermilion focus, fine-grid drafting texture, and restrained level transitions with accessible labels and keyboard actions.
5. Verify targeted projection behavior, the existing full architecture suite, Bun production bundling, clean diffs, and a real browser flow from context → containers → components → back with DOM, console, desktop, and mobile evidence.
6. Finalize TASK-6 through Backlog with criterion-by-criterion evidence, self-review the scoped diff, and commit the clean tree on main.

7. Add red synthetic projection regressions with directly connected inbound/outbound root context plus unrelated people/systems that have relationships only outside the focal subtree; assert filtering at context, container, and component levels.

8. Derive connected root context IDs from relationship endpoints whose containment roots cross into the focal system subtree, and use that set in all three node projections without changing structural children, peer containment, edge promotion, or transient focus state.

9. Commit a reproducible Playwright browser harness and pinned development dependency, then rerun desktop/mobile context → container → component → back verification, full checks, production bundle, groma/ immutability check, Backlog finalization, and direct commit.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Context classification: L2. The viewer crosses the frozen C4 model, new Bun HTTP boundary, and client interaction state. Local pattern: load one revision with loadRevision(), derive it with buildArchitectureModel(), and keep visual state outside the model and groma/.

Visual direction: an architect’s drafting table—warm off-white paper, deep ink-blue frames, vermilion active focus, mono annotations, a quiet line grid, and concise editorial typography. C4 type and hierarchy should be more memorable than dashboard chrome; navigation remains restrained and read-only.

Implemented the pure projection and Bun-served React Flow viewer. Relationship endpoints promote to the nearest visible C4 ancestor, expanded systems/containers render as boundaries, and sibling containers stay siblings under the system boundary. All focus/back state lives in React state; the server exposes only GET /api/model and no groma/ write path.

Interactive verification: the in-app Browser plugin was present but its runtime returned “No browser is available”, so the permitted Playwright fallback exercised http://127.0.0.1:4177 at 1440×960 and 390×844. The script verified title and non-blank context DOM, people/Groma/Git nodes, visible relationship labels, context → Groma containers → Viewer components, Architecture workspace and Git retained in component view, two Previous level actions, no horizontal document overflow on mobile, screenshots, and zero console warnings/errors. It initially caught React Flow pointer interception; the node hit-target policy was corrected and the identical flow then passed.

Final verification: npm run check validated 4 revisions (35 elements, 34 relationships) and passed 43/43 tests; production Bun build bundled 221 modules into a 664K temporary artifact; git diff --check passed; GET /api/model returned only plan / 02-live-viewer with 10 elements and 10 relationships; git diff -- groma/ was empty before and after browser interaction.

Spec review reopened TASK-6: node projection currently selects every person and every non-focal system by kind before edges are projected. As a result, unrelated roots render even though relationshipEdges later drops their edgeless context. Acceptance criteria #1–#3 are unchecked pending relationship-driven root filtering and regression/browser evidence. Root-cause hypothesis: filtering root candidates by relationships crossing between their containment root and the focal system containment root will remove unrelated context while preserving directed/promoted edges and all structural containers/components.

Connected-context correction completed with a red/green cycle. Three synthetic regressions added connected person→focal component, connected external system→focal component, and unrelated person→unrelated system cases; all three level tests first failed because unrelated roots rendered, then passed after root filtering. The projection now traces each relationship endpoint to its containment root and admits a non-focal root only when that directed relationship crosses into or out of the focal system subtree. Structural focal containers/components, sibling peer containment, and promoted edge direction/labels are unchanged.

Browser verification is now reproducible in-repo: pinned @playwright/test 1.62.0, playwright.config.mjs starts/stops the Bun viewer on 127.0.0.1:4177, and e2e/viewer.spec.js exercises the desktop/mobile pointer flow while writing artifacts only under /tmp/groma-playwright-results. The in-app Browser retry returned “No browser is available” and an empty browser inventory, so the permitted committed Playwright fallback was used.

Correction verification: npm run check validated 4 revisions (35 elements, 34 relationships) and passed 46/46 tests; npm run test:viewer:browser passed 1/1 at 1440×960 and 390×844 with context node count, labeled edges, context→containers→components→back, collaborating Architecture workspace/Git visibility, mobile document width, screenshots, and zero console warnings/errors. Production Bun build bundled 221 modules into a 664K temporary artifact; git diff --check passed; git diff -- groma/ remained empty.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Corrected C4 context selection so people and non-focal systems render only when an actual relationship crosses between their containment root and the focal Groma subtree, in either direction. Synthetic regressions cover connected and unrelated roots at context, container, and component levels while retaining promoted directed edges and sibling peers. Added a pinned, reproducible Playwright harness; full verification passed 46/46 unit/integration tests, 1/1 desktop/mobile browser flow, production Bun bundling, diff hygiene, and no groma/ changes.
<!-- SECTION:FINAL_SUMMARY:END -->
