---
id: TASK-225.1
title: Replace Groma’s document contract with an OKF profile
status: Done
assignee:
  - '@codex'
created_date: '2026-08-30 21:44'
updated_date: '2026-08-31 00:25'
labels: []
milestone: m-5
dependencies: []
references:
  - >-
    https://github.com/GoogleCloudPlatform/open-knowledge-format/blob/ad30107c31c06aec8a7d5636e0d1058118604e6f/SPEC.md
  - architecture-reader
  - architecture-model
  - project-profile
  - world-loader
  - architecture-comparison
  - plain-text-view
  - observed-curation
  - scan-lifecycle
  - search
  - world-layout
  - sheet-composition
  - projection
  - flow
  - terminal-painting
  - hierarchy
  - details
  - web-viewer-details
  - page
  - iso-projection
  - iso-map
  - project-editor
  - render
  - flow-controls
  - stats
  - view
  - source-viewer
  - web-viewer-hierarchy
  - task-diff
modified_files:
  - src/okf-profile.ts
  - src/types.ts
  - src/architecture-reader.ts
  - src/architecture-model.ts
  - src/project-profile.ts
  - src/core.ts
  - src/architecture-comparison.ts
  - src/plain-world.ts
  - src/relate.ts
  - src/scan-reconciler.ts
  - src/search.ts
  - src/world-layout.ts
  - src/sheet/types.ts
  - src/sheet/place.ts
  - src/viewers/tui/projection.ts
  - src/viewers/tui/flow.ts
  - src/viewers/tui/organisms/world.ts
  - src/viewers/tui/tree.ts
  - src/viewers/tui/organisms/hierarchy.ts
  - src/viewers/tui/organisms/details.ts
  - src/viewers/tui/paint.ts
  - src/viewers/tui/molecules/boundary.ts
  - src/viewers/tui/molecules/card.ts
  - src/viewers/web/organisms/details.ts
  - src/viewers/web/page.ts
  - src/viewers/web/iso/blueprint.ts
  - src/viewers/web/iso/paint-ground.ts
  - src/viewers/web/iso/style.ts
  - src/viewers/web/project/editor.ts
  - src/viewers/web/render.ts
  - src/viewers/web/flow/list.ts
  - src/viewers/web/flow/row.ts
  - src/viewers/web/chrome/stats.ts
  - src/viewers/web/search/view.ts
  - src/viewers/web/source/view.ts
  - src/viewers/web/iso/paint-buildings.ts
  - src/viewers/web/iso/project.ts
  - src/viewers/web/organisms/hierarchy.ts
  - src/viewers/web/task-diff/view.ts
  - src/code-reference.ts
  - scripts/validate-architecture.ts
  - test/fixtures/validate/groma/index.md
  - test/fixtures/validate/groma/project.md
  - test/fixtures/validate/groma/observed/index.md
  - test/fixtures/validate/groma/observed/README.md
  - test/fixtures/validate/groma/observed/actors/buyer.md
  - test/fixtures/validate/groma/observed/systems/git/system.md
  - >-
    test/fixtures/validate/groma/observed/systems/shop/containers/api/components/orders.md
  - >-
    test/fixtures/validate/groma/observed/systems/shop/containers/api/container.md
  - test/fixtures/validate/groma/observed/systems/shop/system.md
  - test/fixtures/validate/groma/missing/index.md
  - test/fixtures/validate/groma/missing/README.md
  - test/fixtures/validate/groma/plans/index.md
  - test/fixtures/validate/groma/plans/README.md
  - test/fixtures/validate/groma/plans/next/index.md
  - test/fixtures/validate/groma/plans/next/README.md
  - >-
    test/fixtures/validate/groma/plans/next/systems/shop/containers/api/components/stock.md
  - test/validate-architecture.test.ts
  - test/architecture-reader.test.ts
  - test/architecture-model-helpers.ts
  - test/architecture-model.test.ts
  - test/architecture-model-errors.test.ts
  - test/architecture-comparison.test.ts
  - >-
    test/fixtures/validate/groma/missing/systems/shop/containers/api/components/legacy.md
  - test/core.test.ts
  - test/plain-world.test.ts
  - test/project-profile.test.ts
  - test/world-layout.test.ts
  - test-bun/helpers.ts
  - test-bun/action-path.test.ts
  - test-bun/inspect-details.test.ts
  - test-bun/iso-map.test.ts
  - test-bun/openclaw-view.test.ts
  - test-bun/projection.test.ts
  - test-bun/search.test.ts
  - test-bun/sheet-scene.test.ts
  - test-bun/web-task-camera.test.ts
  - test-bun/okf-profile-view.test.ts
  - src/architecture-markdown.ts
parent_task_id: TASK-225
priority: high
type: feature
ordinal: 239000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Replace the architecture reader, domain model, and validation boundary so a Groma project is a strict application profile inside an OKF v0.2 bundle. The profile is recognized explicitly and generic OKF bundles remain outside Groma’s supported input.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 The reader requires the pinned OKF v0.2 bundle declaration and explicit Groma project profile before building an architecture world
- [x] #2 Architecture concepts read kind from standard type and read stable identity, parentage, grouping, technology, external state, and code evidence from the groma mapping
- [x] #3 Standard title and optional description map directly to the domain while leading Markdown body prose maps to overview
- [x] #4 Canonical Groma relationships and C4 containment remain strict even though ordinary OKF metadata and unknown concept types are tolerated within a marked Groma package
- [x] #5 Pre-OKF historical revisions are reported through the existing unsupported-history result rather than a compatibility reader
- [x] #6 Focused parser, model, validation, projection, history, Web, and TUI tests prove the new contract without asserting decorative content
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
1. Define the strict read-side OKF v0.2 Groma profile: require groma/index.md with only okf_version: "0.2" and groma/project.md with type "Groma Project" plus groma.profile "architecture"; parse standard title/description and Markdown body overview while tolerating unowned OKF metadata and unknown concept types.
2. Replace the C4 model boundary with the four canonical C4 type names and nested groma metadata, keeping Groma-owned field validation, containment, relationships, revisions, ghosts, and immutable records strict.
3. Refactor the architecture domain and read-only plain, Web, TUI, search, layout, and history projections to use title, optional description, and overview directly; keep standard description stored but do not add descriptive UI.
4. Make repository validation enforce the package/profile and canonical C4 document contract while tolerating ordinary OKF metadata and unknown types.
5. Add the minimum focused OKF fixture and parallel-safe tests for package rejection, direct field mapping, metadata tolerance, strict containment/relationships, historical incompatibility, and unchanged plain/Web/TUI projections. Run focused checks and bun run check only if the staged subtask state is coherent.

6. Apply the accepted cold-review simplifications: preserve every consecutive leading prose paragraph in element overview, remove duplicate profile validation and kind ownership, use the viewer's ephemeral-port convention, then rerun only directly affected checks.

7. Apply the final full-context simplifications: use validated parentId for containment, make package recognition void and projection-free, simplify GromaProfileError, remove the export smoke test, and rerun only directly affected checks.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Implemented flow: loadArchitecture/loadRevision first parse groma/index.md and require the exact OKF 0.2 declaration, then parse groma/project.md and require type Groma Project plus groma.profile architecture. Revision indexes stay context; every other concept must have a standard type, unknown types are ignored, and only the four C4 types enter the domain builder. The builder reads title and optional description directly, derives overview from the leading body prose, reads the strict nested groma mapping, validates canonical paths, containment, code references, and relationship tables, then core overlays observed documents into missing/planned revisions and produces current ghosts, groups, relationships, layout, plain, Web, and TUI projections from title and overview.

Contract evidence: the focused fixture uses a root index whose only frontmatter field is okf_version: "0.2", a project concept marker, all four C4 types, all supported nested Groma fields, unknown standard metadata, and an ignored ordinary OKF concept with a generic broken link. Focused parser/model/validation/core/project/plain tests pass 44/44; comparison/layout tests pass 7/7; Bun action/details/search/projection tests pass 24/24; Web/TUI/history tests pass 3/3, including an existing 422 Unsupported Groma revision result for pre-OKF history. TypeScript passes, targeted Biome lint passes with no findings, every changed TypeScript file is at most 500 lines, and git diff --check passes.

Correction evidence: architecture Markdown and code-reference validation were split into small helpers to remove new cognitive-complexity warnings. Plain projection tests were rewritten rather than removed: they retain profile integration, title/overview selection, revision winner edges, code lookup, ambiguity, unknown-target, element-versus-plan precedence, and complete/incomplete plan behavior without decorative full-frame snapshots.

Repository check constraint: bun run check was run twice. Biome completed with 27 pre-existing complexity warnings, the scrollbar guard and typecheck passed, then the Node phase stopped at 54 pass / 34 fail because the broader writer, create/edit/accept/scan/CLI fixtures and live groma package still use the retired contract or lack the required root/project marker. Those migrations are explicitly assigned to TASK-225.2 and TASK-225.3, so this task adds no compatibility reader or fallback. No confirmed contract decision was changed.

Cold-review corrections: all four accepted findings are resolved. elementOverview now joins every consecutive non-empty leading paragraph before the first named section, and a two-paragraph model test proves the second paragraph remains while section prose is excluded. Repository validation now relies only on loadArchitecture for bundle/project recognition and has no unreachable ArchitectureValidationError rethrow. c4Kind is the sole C4 type owner in the model. The history test now uses startWebViewer with port 0 and has no separate Node port server.

Correction verification: directly affected reader/model/validation/project-profile tests pass 37/37; focused Web/TUI/history tests pass 3/3; typecheck passes; targeted Biome lint reports no findings; the five affected files are 205, 269, 120, 234, and 129 lines; git diff --check passes.

Final review-fix cycle: all four accepted full-context simplifications are resolved without behavior changes. Containment now uses the already validated element.parentId and no longer tracks declaredParentIds or reparses the groma mapping. The reader helper is requireGromaPackage, returns void, and leaves ProjectProfile projection to project-profile.ts. GromaProfileError retains its dedicated class and sourceFilename but no unused code field. The model export smoke test was removed while every business-behavior model test remains.

Final-cycle verification: directly affected model/reader/validation/project-profile tests pass 36/36; typecheck passes; targeted Biome lint reports no findings; affected files are 263, 291, 152, and 230 lines; git diff --check passes; searches find no declaredParentIds, old helper name, or three-argument GromaProfileError construction. No behavior, new paths, or TASK-225.2 files were added.

Final architecture review: PASS. The reviewed read path has one profile authority, one strict C4 semantic model, and shared title/description/overview projections. Accepted simplifications removed duplicate parent state, projection-shaped package recognition, an unused error field, and a non-behavior smoke test. The complete final repository check later passed Node 91/91 and Bun 207/207.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Replaced Groma’s reader, model, validation, history, and viewer projections with a strict OKF v0.2 Groma profile. Focused contract checks, cold review, and full-context review passed; the final repository suite passes Node 91/91 and Bun 207/207.
<!-- SECTION:FINAL_SUMMARY:END -->
