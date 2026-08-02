---
id: TASK-6
title: Render the interactive C4 viewer
status: Done
assignee:
  - '@codex'
created_date: '2026-07-27 20:55'
updated_date: '2026-07-27 22:54'
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
  - src/viewer/focus.mjs
  - src/viewer/index.html
  - src/viewer/main.jsx
  - src/viewer/projection.mjs
  - src/viewer/server.mjs
  - src/viewer/styles.css
  - src/viewer/viewer-app.jsx
  - test/viewer-focus.test.mjs
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

10. Refactor the committed Playwright spec around a small reusable three-level flow that asserts exact visible node IDs and directed edge endpoint pairs for container and component views, then run it independently at desktop and mobile sizes including both back actions.

11. Preserve context labels, screenshots, mobile width, and console-health checks; rerun the browser/full suites, correct the overstated Backlog evidence, finalize, and commit only test/evidence changes.

12. Reproduce and lock the Plan 03 component-to-sibling-container transition with a pure focus-state regression and an independent browser flow; replace the selected container segment instead of extending the focus path.

13. Add human-readable source, target, and relationship descriptions/technologies to each projected directed edge and expose them as one accessible semantic unit, with projection and browser assertions.

14. Raise the compact-viewport fit floor so rendered nodes and labels remain readable while preserving React Flow pan/zoom navigation; assert effective node and title geometry at 390px in context and component views.

15. Restore keyboard focus to the new level heading after navigation, declare the verified Bun runtime floor, then run targeted red/green tests, full browser/unit/build checks, groma/ cleanliness, Backlog finalization, and commit.
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

Second spec review reopened TASK-6 for an evidence gap, not a runtime defect. The committed browser test title and Backlog note claimed context→container→component→back coverage at both 1440×960 and 390×844, but the mobile branch only reloaded context, checked document width, and captured a screenshot. Acceptance criteria #2–#4 are unchecked until the checked-in mobile flow actually pointer-navigates both expansions and both back steps with exact container/component node and edge membership assertions.

Browser evidence gap corrected. e2e/viewer.spec.js now uses one small exerciseThreeLevelFlow helper for two independent viewports. At both 1440×960 and 390×844 it asserts exact context node/edge membership and labels, pointer-clicks Groma, asserts the exact 6 container-level nodes and 6 directed edge IDs, pointer-clicks Viewer, asserts the exact 10 component-level nodes and 10 directed edge IDs, then clicks Previous level twice and reasserts exact container/context membership after each return. It captures context and component screenshots for both sizes; the mobile branch also verifies document width, and the combined run asserts zero console warnings/errors. This supersedes the prior overstated mobile-flow claim.

Fresh verification: npm run test:viewer:browser passed 1/1 in 1.8s with both complete viewport flows; npm run check validated 4 revisions (35 elements, 34 relationships) and passed 46/46 tests; git diff --check passed; git diff -- groma/ was empty. No runtime source or architecture Markdown changed in this correction.

Quality review reopened TASK-6. Confirmed risks: container expansion appends to a two-segment component focus path and can produce an invalid third segment; compact fitView permits approximately 0.21–0.27 scale; projected edges carry only internal endpoint IDs plus a visual label. Acceptance criteria #1–#4 are unchecked until focused regressions, browser evidence, and full verification pass.

Quality-review corrections completed with red/green coverage. Focus navigation is now a pure transition: selecting a container always produces [focal system, selected container], so Plan 03 Viewer → Scanner → Viewer remains at component level. Each projected edge carries displayed source/target names, all description/technology labels, and one combined accessible name on the React Flow edge; the duplicated visual label is aria-hidden. Compact viewports use a 0.55 zoom floor, remount fit behavior on breakpoint changes, drag/pinch navigation, and visible mobile instructions. Level headings receive focus after expansion, sibling switching, breadcrumb navigation, and back navigation. The verified Bun 1.3.14 floor is declared in package metadata and README.

Fresh objective evidence: npm run check validated all 4 revisions (35 elements, 34 relationships) and passed 50/50 tests. npm run test:viewer:browser passed 2/2: the complete Revision 02 context → container → component → back flow at 1440×960 and 390×844, plus Plan 03 Viewer ↔ Scanner sibling switching. Browser assertions cover exact node/edge membership, every relationship accessible name and its visible label/technology, post-navigation heading focus, zero console/page errors, and mobile effective geometry of at least 145px for the focal system, 100px for a component, and 9px title height. Bun production build bundled 140 modules into a 0.60 MB entry plus CSS/HTML. git diff --check passed and groma/ remained clean.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Corrected the interactive viewer’s three quality-review issues: sibling container selection now replaces container focus without invalid paths; compact layouts keep nodes and titles readable with pan/pinch navigation; and each directed edge exposes one human-readable source → target + description/technology accessible name. Added pure focus, Plan 03 projection, dual-revision browser, accessibility, geometry, and keyboard-focus regressions. Verified 50/50 repository tests, 2/2 browser tests across desktop/mobile and Revision 02/Plan 03, a successful Bun production build, clean diffs, and no groma/ changes.
<!-- SECTION:FINAL_SUMMARY:END -->
