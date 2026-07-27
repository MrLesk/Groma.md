---
id: TASK-6
title: Render the interactive C4 viewer
status: Done
assignee:
  - '@codex'
created_date: '2026-07-27 20:55'
updated_date: '2026-07-27 22:32'
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
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Context classification: L2. The viewer crosses the frozen C4 model, new Bun HTTP boundary, and client interaction state. Local pattern: load one revision with loadRevision(), derive it with buildArchitectureModel(), and keep visual state outside the model and groma/.

Visual direction: an architect’s drafting table—warm off-white paper, deep ink-blue frames, vermilion active focus, mono annotations, a quiet line grid, and concise editorial typography. C4 type and hierarchy should be more memorable than dashboard chrome; navigation remains restrained and read-only.

Implemented the pure projection and Bun-served React Flow viewer. Relationship endpoints promote to the nearest visible C4 ancestor, expanded systems/containers render as boundaries, and sibling containers stay siblings under the system boundary. All focus/back state lives in React state; the server exposes only GET /api/model and no groma/ write path.

Interactive verification: the in-app Browser plugin was present but its runtime returned “No browser is available”, so the permitted Playwright fallback exercised http://127.0.0.1:4177 at 1440×960 and 390×844. The script verified title and non-blank context DOM, people/Groma/Git nodes, visible relationship labels, context → Groma containers → Viewer components, Architecture workspace and Git retained in component view, two Previous level actions, no horizontal document overflow on mobile, screenshots, and zero console warnings/errors. It initially caught React Flow pointer interception; the node hit-target policy was corrected and the identical flow then passed.

Final verification: npm run check validated 4 revisions (35 elements, 34 relationships) and passed 43/43 tests; production Bun build bundled 221 modules into a 664K temporary artifact; git diff --check passed; GET /api/model returned only plan / 02-live-viewer with 10 elements and 10 relationships; git diff -- groma/ was empty before and after browser interaction.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Added Groma’s first read-only local C4 viewer: a Bun server loads exactly one selected revision, React Flow renders promoted labeled relationships and nested C4 boundaries, and transient React navigation decomposes Groma into containers and Viewer into components with breadcrumb/back controls. Verified with 4 focused projection tests, the full 43-test repository check, a production Bun bundle, and a real Playwright context → container → component → back interaction run at desktop and mobile sizes with zero browser warnings/errors and no groma/ changes.
<!-- SECTION:FINAL_SUMMARY:END -->
