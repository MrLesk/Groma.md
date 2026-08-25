---
id: TASK-165
title: Make the web sheet an editable project blueprint
status: Done
assignee:
  - '@codex'
created_date: '2026-08-24 18:10'
updated_date: '2026-08-25 21:06'
labels: []
dependencies: []
references:
  - web-viewer
  - web-server
  - render
  - iso-map
  - iso-projection
  - page
  - architecture-watch
  - markdown-emitter
  - project-profile
  - core
  - project-editor
modified_files:
  - src/project-profile.ts
  - test/project-profile.test.ts
  - src/viewers/web/payload.ts
  - src/viewers/web/server.ts
  - src/viewers/web/iso/project.ts
  - src/viewers/web/iso/paint-ground.ts
  - src/viewers/web/iso/style.ts
  - src/viewers/web/iso/map.ts
  - src/viewers/web/project/editor.ts
  - src/viewers/web/page.ts
  - src/viewers/web/render.ts
  - docs/component-markdown.md
  - groma/README.md
  - groma/observed/README.md
  - test-bun/iso-map.test.ts
  - test-bun/web-task-camera.test.ts
  - test-bun/web-page.test.ts
  - test-bun/web-live.test.ts
  - docs/index.md
  - docs/product-model.md
  - README.md
  - MANIFESTO.md
  - docs/viewers/creating-a-plugin.md
  - docs/viewers/web/index.md
  - groma/observed/systems/groma/containers/core/components/project-profile.md
  - groma/observed/systems/groma/containers/core/container.md
  - groma/observed/systems/groma/containers/web-viewer/components/web-server.md
  - >-
    groma/observed/systems/groma/containers/web-viewer/components/iso-projection.md
  - >-
    groma/observed/systems/groma/containers/web-viewer/components/project-editor.md
  - groma/observed/systems/groma/containers/web-viewer/components/render.md
  - >-
    groma/observed/systems/groma/containers/core/components/architecture-watch.md
  - groma/observed/systems/groma/containers/web-viewer/components/page.md
  - groma/observed/systems/groma/containers/web-viewer/components/iso-map.md
  - groma/observed/systems/groma/containers/web-viewer/container.md
  - src/project-markdown.ts
  - src/viewers/web/iso/blueprint.ts
  - package.json
  - design-qa.md
  - bun.lock
priority: high
type: feature
ordinal: 176000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
When a project owner opens `groma web`, the sheet must use the user-owned `groma/README.md` as its project identity: an H1 project name and lead description. The sheet presents that identity in a blueprint title plate with one isometric pencil action that opens a floating editor. Saving updates the profile through Groma core and refreshes the live map. Blueprint crop marks and the compass scale with the sheet instead of appearing as fixed, faint glyphs. Product instructions currently stored as project data move into `docs/`, and generated revision READMEs stay minimal.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 The project profile contract is an H1 project name followed by lead prose in groma/README.md, and the web sheet displays both values.
- [x] #2 An isometric pencil on the title plate opens a focused floating form; saving changes the project profile through the server and core, then updates the live sheet without a browser reload.
- [x] #3 The compass and corner or crop marks are clear and proportional on representative small and large maps, while the title plate remains a sheet decoration and does not cover architecture.
- [x] #4 Component Markdown and product-use instructions live under docs; groma/README.md and groma/observed/README.md no longer act as Groma product documentation.
- [x] #5 Focused automated tests cover project-profile read/write behavior and blueprint projection or layout invariants, and the supported browser flow passes visual and interaction QA.
- [x] #6 The profile editor has Write and Preview modes, and both its preview and the blueprint title plate render supported lead Markdown without exposing raw formatting syntax.
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
1. Treat groma/README.md as a strict H1 name plus complete Markdown body for parse and save, while tolerant web loading returns no profile for missing or invalid input.
2. Render editor Preview with @comark/html plus the Comark security plugin; keep the small Comark-to-rich-text adapter only for the compact SVG title plate.
3. Keep blueprint geometry in iso/blueprint.ts: one grayscale frame, proportional compass, unlabeled calibration ticks, and an optional south-east title plate whose width fits visible content up to 80 characters, wraps beyond that threshold, grows only south, and keeps explicit content inset and pencil gutter rules.
4. Keep SVG construction in paint-ground.ts, including the approved faceted ground-plane pencil; keep editor behavior in web/project and direct profile save plus SSE publication in the web server. Omit the whole plate, pencil, and edit target when no profile exists.
5. Keep plain and styled wrappers separate but share their long-token chunking rule; keep link destinations in the editor's source renderer and only link styling in the SVG model.
6. Keep observed Code frontmatter scanner-authoritative. The current one-file-per-candidate scanner cannot durably attach project-markdown.ts to project-profile; multi-file grouping remains a non-blocking scanner follow-up outside TASK-165.
7. Verify strict save and tolerant load, Markdown semantics, content-fit and 80-character projection invariants, south-only frame growth, editor save/publication, full type/test suites, task traceability, and real browser views before asking for final approval.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Implementation completed in the shared main workspace. The supported flow is: `groma web` reads architecture plus the H1 and lead prose from `groma/README.md`; the isometric projection keeps the semantic sheet unchanged and adds a proportional drafting band; the pencil opens a project-domain dialog; `PUT /project` saves through core; the existing watcher and SSE publication repaint the sheet without reload.

Verification: `bun run check` passed (95 core tests, 179 viewer tests, typecheck). Browser QA passed in light and dark themes at representative viewport size; pointer and keyboard activation opened the editor, save updated the live sheet through SSE, and the original profile was restored. No console warnings or errors. After the cold simplicity cleanup, `bun run typecheck` and 23 focused project/profile/web/projection tests passed. `git diff --check` passed.

Cold simplicity review: pass. It could explain the full flow, found no blocking complexity, and suggested only two local collapses: reuse the computed drafting frame and infer the editor factory return type. Both were applied, and focused checks passed again.

Correction after the full-context complexity review: profile saves no longer use the architecture watcher. `PUT /project` saves through core and calls `publishWorld()` directly; `watchArchitecture` again owns architecture Markdown only. The targeted re-review passed, and the focused suite confirmed save → SSE → repaint without reload.

Final verification after direct publication: 21 focused web/projection tests, 2 core profile tests, and type checking passed. The full 95 core tests passed. The default 20-second viewer run twice starved one architecture-watch test while other concurrent layout tests ran; that test passed in 0.3 seconds alone, passed in the focused concurrent file, and all 179 viewer tests passed unchanged with a 40-second suite allowance. This is test-runner scheduling, not a supported-flow failure; no product or timeout code was added. `git diff --check` passed.

User visual review reopened the task: the rendered compass was too large, project text escaped its plate instead of extending the boundary, the pencil was weak, an unintended inner sheet boundary remained visible, and save waited for a full world reload. AC 2, 3, and 5 and the completion record were reopened until these observable issues are corrected and reverified.

User-reported polish corrections completed. Profile save now updates the cached project and broadcasts without reloading architecture (about 1 ms in local HTTP timing). Project text wraps without a line cap; the title plate depth and single outer frame grow with its lines. The unintended inner plot boundary was removed. The compass was reduced and the pencil is now a larger, undistorted screen-space drawing inside the isometric edit cell.

Corrective browser QA used the in-app Browser at http://localhost:4872. A five-line profile was extended to eight repetitions: the description grew from 9 to 14 rendered lines, the frame geometry changed, every line stayed inside the plate, and the original five-line project profile was restored exactly. Pointer save and keyboard open passed; one visible boundary was present; light and dark screenshots passed; console warnings/errors were empty. `bun run check` passed: typecheck, 95 core tests, and 179 viewer tests.

Corrective cold simplicity review passed with no blocking findings. Its one optional consolidation replaced a duplicate text-width formula with the shared `textWidth` rule; typecheck, 20 focused tests, and diff hygiene passed afterward.

The required final full-context complexity review passed with no blocking findings. It confirmed the corrected flow uses the fewest useful concepts, keeps profile persistence, editor behavior, pure geometry, painting, host orchestration, and browser state in clear domains, and reduces junior mistakes by preventing profile saves from invoking architecture scan/layout. No further deletion or abstraction was recommended.

User reopened TASK-165 again: Markdown must be editable and rendered; the pencil must be isometric; crop-mark and frame weights must match; and the sheet needs a coherent set of blueprint glyphs and decorations. AC 2, 3, 5, the Definition of Done, and completion summary were reopened.

Implemented the correction as two small domains. Project Markdown now preserves source and derives safe rich-text blocks shared by the editor Preview and SVG title plate. Blueprint-only geometry moved from the 482-line general projector into iso/blueprint.ts; the projector is now 302 lines. The blueprint owns one frame, detached crop crosses, compass, title metadata, and a pencil transformed by the ground-plane matrix. Browser QA confirmed equal computed frame/tick stroke widths (4.9px at the inspected zoom), the ground-plane pencil matrix, rendered bold/emphasis/code, a 3.9 ms local profile PUT, exact profile restoration, light/dark rendering, and no console warnings or errors.

Latest cold simplicity review passed with no blocking findings. Applied both local reductions: removed the unused markdownBlockText export and renamed the stale ticks/.tick model to cropMarks/.crop-mark. Type checking, 2 profile tests, 20 focused web/projection/live tests, and diff hygiene passed after the cleanup.

The required full-context complexity review passed the implementation. It would choose the same approach: shared browser-safe Markdown semantics, separate untrusted input/trusted derived profile types, blueprint geometry separated from SVG painting, and direct save/SSE publication. It found no production-code change. Its stale-plan finding was fixed by removing unimplemented dimensions; its architecture-record finding was fixed by restoring project-markdown.ts under the existing project-profile component.

User rejected the latest rendered result. The screenshot shows an oversized title annotation, an arrow-like pencil, and a heavy isometric X instead of a precise corner plus. User also clarified that the blueprint layer must be grayscale only. The task remains open; previous visual approval evidence is superseded.

Final visual correction: the long-profile title plate was reduced to compact blueprint typography and widened so its one boundary still grows with wrapped Markdown. The pencil now uses one isometric ground-plane outline with separate grayscale eraser, ferrule, wood tip, and lead; overlapping interior strokes were removed. Four upright registration pluses are detached from the frame and share its exact stroke rule. All added blueprint states use only neutral map variables, including hover/focus.

Verification after the correction: Browser QA passed at fit and 305% relative zoom in light and dark themes. The fit view shows four distinct pluses and a subordinate title plate; an actual-browser crop confirmed the pencil silhouette and tip. Computed dark-theme styles for frame marks, compass, plate, and every pencil part use only neutral map colors. Write/Preview rendered the current Markdown, PUT /project completed in 0.002162 seconds, and the dialog closed without a reload. bun run check passed: typecheck, 95 core tests, and 180 viewer tests. git diff --check passed.

Final cold simplicity review passed. The reviewer traced CLI start -> profile load -> blueprint projection -> SVG painting -> editor -> PUT /project -> cached profile/SSE -> repaint. It found no blocking or optional simplification worth applying: each required concern has one owner, the tests cover distinct behavior, and further helpers or file splits would add indirection.

Final full-context complexity review passed with no blocking finding. It would keep the same domains: core profile persistence and safe Markdown semantics, web/project editor behavior, iso/blueprint pure drafting geometry, paint-ground SVG construction, and thin server/render orchestration. This split prevents raw client-derived state, duplicate Markdown interpretations, save-triggered scans/layout, and geometry hidden in DOM code. No production deletion, collapse, rename, or further split was recommended.

Shared-workspace coordination: TASK-170 temporarily changed the flow-details signature while this review ran. TASK-165 did not touch that overlap; TASK-170 completed its matching call-site and typecheck passed. A separate concurrent write removed the TASK-165 project-markdown.ts code reference from the project-profile architecture document; the task-owned entry was restored, `bun src/cli.ts view --plain` loaded successfully, and diff hygiene passed.

Right-edge placement correction: the complete title plate now occupies the lower-right drafting band east of the semantic sheet. Its wrapping, isometric pencil, Markdown model, and grayscale styling are unchanged. The outer frame expands east to enclose the annotation and still expands south when extended text exceeds the existing margin.

Verification: typecheck and 16 focused blueprint/page tests passed after the placement change. Browser QA at http://localhost:4872 passed at fit and 195% zoom in light and dark themes; the annotation is visibly nearer the lower-right edge, remains outside architecture, the pencil still opens the editor, and warning/error logs were empty. A later full-check attempt encountered four missing TUI camera exports during another agent’s live TUI refactor; TASK-165 did not touch those files or treat that transient shared-workspace state as its blocker.

The post-placement cold simplicity review passed with no findings. It confirmed the lower-right annotation needs only one ground-space placement rule and two explicit frame extents; no code, helper, abstraction, or test should be removed.

The required full-context complexity review also passed. It would keep the same approach because plate, pencil, and frame share one coordinate system and isometric transform. A screen-space offset or second layout pass would increase clipping and zoom mistakes. Domain grouping remains clear and protects junior developers from mixing trusted Markdown, persistence, geometry, DOM painting, and host orchestration.

Concurrent workspace drift removed the project-markdown code entry from the project-profile architecture record again. TASK-165 restored the existing entry without touching the overlapping web or TUI work; the architecture loaded and task-scoped diff hygiene passed.

Final placement and pencil correction: the title plate now starts in the south-east drafting band, closer to the lower frame. The pencil no longer runs across the edit cell’s short gx axis. Its measured length follows the longer gy axis, with the eraser at lower-left and sharpened lead pointing up-right; length and thickness are capped so extended Markdown cannot enlarge the glyph.

Verification: a close browser crop at 305% showed the pencil aligned with the edit cell’s long edge and its eraser, ferrule, body, wood, and lead remained distinct. Fit and dark-mode views passed, the edit dialog still opened with its name field focused, the ground-plane matrix remained active, and browser warning/error logs were empty. bun run check passed with typecheck, 95 core tests, and 178 viewer tests; task-scoped diff hygiene passed.

Concurrent workspace drift again removed the existing src/project-markdown.ts ownership entry from the project-profile architecture record. Restored only that task-owned entry after the final pencil correction.

The required full-context review found no authority-backed blocker. It would keep the current gy-axis pencil: five grayscale parts plus one seam path are the minimum clear isometric silhouette, and using the shared ground-plane transform prevents a separate screen-space rotation. It found the domain grouping clear and recommended no deletion, collapse, rename, or split.

Corrected blueprint geometry in src/viewers/web/iso/blueprint.ts: the east frame is fixed at its normal margin, the title plate is right-aligned inside that boundary, only the south frame can grow with text depth, and registration pluses now follow the isometric gx/gy axes.

Flipped the pencil end-for-end in src/viewers/web/iso/paint-ground.ts without changing its size or typography: the eraser is now at the upper-right end and the sharpened lead points lower-left.

Updated test-bun/iso-map.test.ts to encode the corrected product rules: crop-mark arms must follow gx and gy, the title plate is south of architecture and inside the east frame, extended text leaves the east boundary unchanged, and only the south boundary grows.

Verification after the south-only correction: typecheck and 16 focused blueprint/page tests passed. The in-app Browser was restarted to avoid stale code, then fit and 244% views confirmed the plate inside the fixed east frame, the pencil lead at lower-left, and registration pluses aligned to gx/gy; the editor opened and closed, and browser warning/error logs were empty. The full run hit the unrelated scan-watch timing assertion once; that test passed alone, and the complete 178-test viewer suite passed. Task-scoped diff hygiene passed.

Applied the cold simplicity review’s only suggested reduction: test-bun/iso-map.test.ts now shares one inverse isometric projection helper instead of repeating it.

Added @comark/html 0.5.1, matching the existing Comark 0.5.1 parser, so the editor Preview can use the maintained framework-free renderer instead of Groma-owned paragraph DOM construction.

Changed src/viewers/web/project/editor.ts to use @comark/html with Comark security filtering for Preview. Removed Groma-owned paragraph/span DOM rendering; headings, lists, quotes, code, emphasis, and safe links now use library HTML semantics.

Changed src/project-profile.ts so the project description is the complete Markdown body after the project H1. H2 and later blocks now survive save, publication, and reload instead of being treated as an end-of-profile delimiter.

Changed src/project-markdown.ts so heading blocks remain separate and render as strong SVG text in the compact title plate. The Preview keeps true H1-H6 semantics through the library renderer; the SVG adapter intentionally preserves the existing description font size.

Updated test/project-profile.test.ts to prove an H2 and its following content remain in the profile body, the title-plate model marks the heading strongly, and H2 Markdown round-trips through save and load.

Updated docs/product-model.md: groma/README.md now documents the H1 as the project name and the complete remaining Markdown body as the description.

User clarified the defensive contract: invalid profile loading is represented as undefined in-process and null in the web JSON payload, so projection can omit the entire title plate and pencil without an empty-profile sentinel.

Changed src/project-profile.ts so the web-facing loader returns undefined for a missing, unreadable, malformed, or incomplete project profile while the parser and save path remain strict.

Changed src/viewers/web/payload.ts so an absent project profile is represented as JSON null instead of an invalid profile object.

Changed src/viewers/web/server.ts so startup and world refresh publish project: null when no valid profile can be loaded; successful saves still publish the validated profile.

Changed src/viewers/web/iso/blueprint.ts so projectBlueprint accepts no profile, keeps the normal symmetric frame, and omits projectPlate entirely instead of projecting an empty box and pencil.

Changed src/viewers/web/iso/project.ts so scene projection supports an absent project profile without manufacturing placeholder profile data.

Changed src/viewers/web/iso/paint-ground.ts so the title plate and its edit pencil are painted only when a projected project plate exists.

Changed src/viewers/web/render.ts so JSON null becomes an internal undefined profile; project projection still runs, while edit actions open only when a real profile exists.

Changed test/project-profile.test.ts to prove tolerant loading returns undefined for an incomplete README before a strict save creates a valid profile.

Changed test-bun/iso-map.test.ts to cover the no-profile projection: no project plate exists and the base sheet frame keeps its normal symmetric footprint.

Changed test-bun/web-page.test.ts to prove the complete web shell is rendered when the embedded project payload is null.

Changed test-bun/web-live.test.ts to reproduce the reported incomplete README startup and verify the web page still returns 200 while /world.json publishes project: null.

Changed docs/viewers/web/index.md to document that the editor Preview uses Comark's sanitized HTML renderer while the title plate projects the same parsed Markdown semantics into SVG.

Changed the observed project-profile component Markdown to map both parser files and document the strict parse/save boundary plus tolerant optional load result.

Changed the observed project-editor component Markdown to identify Comark's sanitized HTML renderer as the Preview boundary.

Changed the observed iso-projection component Markdown to document ground-axis registration marks, optional profile decorations, and south-only frame growth.

Changed the observed web-server component Markdown to document the optional-profile JSON null contract and omission of the title plate for invalid input.

Changed src/project-markdown.ts documentation to keep its responsibility narrow: adapting parsed prose only for the SVG title plate, not rendering the editor Preview.

Optional-profile cold simplicity review passed. The reviewer traced strict parse/save -> tolerant undefined load -> JSON null -> undefined projection -> omitted projectPlate/pencil, and the valid H1-plus-full-body Markdown path through Comark HTML security and SSE repaint. It found no code, concepts, indirection, or tests to delete or collapse; the undefined/null conversion is the necessary in-process/JSON boundary and the modules are easy for an unfamiliar developer to follow. Verification passed: typecheck, 95 node tests, 167 viewer tests, task-scoped diff hygiene, browser H2 semantics with no script execution, and a real no-profile map with project:null, no plate/edit target, and an empty console.

Corrected src/viewers/web/iso/blueprint.ts after the user screenshot: registration centres remain anchored outside the projected frame corners, but their equal arms are now horizontal and vertical in screen space so the visible glyph is a + rather than an isometric ×.

Corrected src/viewers/web/iso/paint-ground.ts after the user screenshot: removed the pencil's long centre seam that read as an arrow and added one inset body facet while preserving the isometric ground transform, upper-right eraser, and lower-left lead.

Corrected src/viewers/web/iso/style.ts so the simplified pencil silhouette has visible neutral-gray body, facet, ferrule, eraser, wood, and lead regions; no color was added.

Changed test-bun/iso-map.test.ts to encode the corrected registration-glyph invariant: each detached mark has equal screen-horizontal and screen-vertical arms sharing one centre outside its frame corner.

Updated the iso-projection architecture record to describe the corrected screen-readable registration pluses instead of the rejected ground-axis marks.

Browser QA after restarting the server passed at fit, 244%, 381%, and 477% zoom. The lower registration mark is visibly a screen-upright +, not an ×. Its SVG path has equal 48-unit horizontal and vertical arms, and its computed stroke exactly matches the frame at 6.272px. The pencil remains on matrix(1 0.5 -1 0.5 ...), reads as one faceted grayscale pencil with no arrow-like centre seam, and uses only neutral computed fills. Browser error logs were empty. Evidence: /tmp/task-165-corrected-plus-fit.png, /tmp/task-165-corrected-plus-pencil-close.png, /tmp/task-165-corrected-pencil-max.png.

Latest glyph-correction cold simplicity review passed with no findings. It confirmed the two screen-space segments are the minimum + geometry; the outlined pencil, one inset facet, separate end parts, and three short boundary seams are the minimum visible pencil parts; geometry, SVG construction, and grayscale styling stay in their correct domains; and the focused assertions each protect a distinct supported invariant.

Complete viewer verification after the glyph correction passed: 167 tests, 0 failures. TASK-165 remains In Progress pending the user's visual approval; no commit or push was made.

Full-context simplification and complexity review passed. The reviewer would keep the same five-domain flow: strict profile persistence plus tolerant optional loading, safe Markdown derivation, project editor behavior, pure blueprint geometry, and thin SVG/server/browser orchestration. Applied four reductions: shared long-token chunking, removed unused SVG link destinations, named content inset and pencil gutter separately, and corrected stale publication/rebuild comments. This structure reduces junior error paths by keeping untrusted Markdown, persistence, geometry, painting, and live publication in separate owners. The only remaining ownership gap is the production scanner's one-file-per-candidate limit; it is a non-blocking scanner follow-up and does not justify complexity in TASK-165. Recheck passed: typecheck, 23 focused tests, 95 core tests, and task-scoped diff hygiene. The shared viewer run passed 151 of 152 tests; the remaining tree-navigation assertion is unrelated concurrent TUI work and is not touched by TASK-165.

Final approval and verification: Alex approved closing TASK-165. The final non-watching check passed TypeScript noEmit, 21 focused web/projection tests, 2 core profile tests, and task-scoped diff hygiene. The recorded in-app Browser evidence covers light/dark rendering, representative fit and zoomed maps, grayscale decorations, content-fit and south-only title-plate growth, focused pencil activation, Write/Preview Markdown semantics, direct save/SSE repaint, optional invalid-profile omission, and an empty relevant console. The final complexity review kept the five-domain architecture and applied its small deletions and naming corrections. The localhost process had been intentionally closed before finalization; it was not restarted in the shared workspace because its production scanner could rewrite other agents' generated architecture.

Commit-isolation verification on current main (including completed TASK-169, excluding live TASK-172 hunks): typecheck passed; 22 focused viewer tests and 2 core profile tests passed; the complete 159-test viewer suite passed. The repository-wide run passed 94 of 95 core tests and stopped on the known scan-watch timing assertion; that exact test passed alone in 1.24 seconds. This snapshot contains only TASK-165 paths and selected hunks, and diff hygiene passes.
<!-- SECTION:NOTES:END -->

## Comments

<!-- COMMENTS:BEGIN -->
created: 2026-08-25 16:46
---
Selected visual target: combined ImageGen mockup exec-d9c9edd1-d936-4cf6-92e8-e4d0ee7c0703.png. The authorized implementation keeps one outer frame, compass, current title plate and approved pencil, and replaces detached pluses with grayscale, unlabeled front-edge calibration ticks plus one datum inside the lower corner. No numbers or fake blueprint metadata.
---

created: 2026-08-25 16:47
---
Changed src/viewers/web/iso/blueprint.ts: removed the rejected detached registration pluses. The blueprint now projects unlabeled calibration ticks along only the two front frame edges and one proportional datum target fully inside the lower corner.
---

created: 2026-08-25 16:48
---
Changed src/viewers/web/iso/paint-ground.ts: the sheet painter now draws the projected calibration path and one concentric datum glyph; the existing frame, compass, title plate, and approved pencil painter are unchanged.
---

created: 2026-08-25 16:48
---
Changed src/viewers/web/iso/style.ts: calibration and datum linework use the existing neutral map tokens. The outer frame remains the single heavy boundary; the new drafting marks are intentionally finer and contain no color, labels, or numeric metadata.
---

created: 2026-08-25 16:48
---
Changed src/viewers/web/iso/project.ts: camera bounds no longer include removed outside crop marks. The frame now encloses every blueprint decoration, so the existing frame plus architecture bounds remain the full fit authority.
---

created: 2026-08-25 16:49
---
Changed test-bun/iso-map.test.ts: replaced obsolete detached-plus assertions with layout invariants for front-edge ticks and the lower datum. The tests now prove those decorations stay inside the frame and scale with representative sheet sizes, without asserting decorative strings or colors.
---

created: 2026-08-25 16:49
---
Changed groma/observed/systems/groma/containers/web-viewer/components/iso-projection.md: the architecture record now names the implemented front-edge calibration and internal lower-corner datum instead of the deleted detached pluses.
---

created: 2026-08-25 16:49
---
Changed docs/viewers/web/index.md: the public web-viewer description now documents unlabeled front-edge calibration ticks and the internal lower-corner datum.
---

created: 2026-08-25 16:49
---
Adjusted test-bun/iso-map.test.ts after the first focused run: frame containment now uses the inverse-projection tolerance needed for fractional calibration spacing. The product geometry was unchanged.
---

created: 2026-08-25 16:53
---
Adjusted src/viewers/web/iso/blueprint.ts after real browser inspection: the first datum position was hidden under the approved pencil. The datum now remains in the lower-corner band but moves up the right front edge, with a slightly larger proportional radius, so the two decorations cannot occupy the same visible slot.
---

created: 2026-08-25 16:55
---
Refined src/viewers/web/iso/blueprint.ts from the second browser capture: the datum moves farther up the right front edge and grows modestly, creating clear space from the pencil at fit and working zoom while remaining proportional and inside the frame.
---

created: 2026-08-25 16:59
---
Added design-qa.md: the selected ImageGen mock and real browser captures were compared together. The first datum placement failed due pencil overlap; the final placement passed at fit, 195% zoom, and dark mode with no P0/P1/P2 mismatch in the approved scope.
---

created: 2026-08-25 17:01
---
Cold simplicity review passed. It traced projectScene -> projectBlueprint -> paintSheet -> neutral CSS and found no production code, concepts, indirection, or tests to remove. Applied its one documentation cleanup in docs/viewers/web/index.md by deleting the obsolete crop-mark wording.
---

created: 2026-08-25 17:01
---
Verification for the approved decoration revision: bun run check passed (typecheck, 95 core tests, 155 viewer tests); task-scoped diff hygiene passed. In-app Browser QA passed at fit, 195% zoom, and dark mode. The pencil opened the dialog and focused the name input; Cancel closed it; browser warnings/errors were empty.
---

created: 2026-08-25 17:29
---
User follow-up: remove the datum cross and make the title plate slightly narrower while preserving its south/east alignment and south-only growth.
---

created: 2026-08-25 17:29
---
Changed src/viewers/web/iso/blueprint.ts: deleted the datum concept and geometry entirely. Reduced the title-plate width from 50% to 44% of the semantic sheet; its east-edge formula, south-band origin, and south-only frame-growth rule are unchanged.
---

created: 2026-08-25 17:30
---
Changed src/viewers/web/iso/paint-ground.ts: removed the datum renderer and its type dependency. The sheet painter now draws only the frame, front-edge calibration, compass, optional title plate, and pencil.
---

created: 2026-08-25 17:30
---
Changed src/viewers/web/iso/style.ts: removed every datum selector. No hidden cross styling remains; calibration, compass, title plate, and pencil continue to use the neutral map palette.
---

created: 2026-08-25 17:30
---
Changed test-bun/iso-map.test.ts: removed obsolete datum assertions and added a large-sheet invariant that keeps the title plate at or below 45% of semantic-sheet width while preserving fixed east alignment and south-only growth.
---

created: 2026-08-25 17:31
---
Changed docs/viewers/web/index.md: removed the datum from the public blueprint description; the viewer now documents only the retained front-edge calibration.
---

created: 2026-08-25 17:32
---
Changed groma/observed/systems/groma/containers/web-viewer/components/iso-projection.md: removed the datum responsibility and recorded the narrower east-aligned title plate with south-only wrapping.
---

created: 2026-08-25 17:43
---
Updated design-qa.md with the user’s latest two screenshots and the new browser evidence. The focused comparison confirms the datum is absent and the plate is 12% narrower while retaining its south/east alignment; final result remains passed.
---

created: 2026-08-25 17:44
---
Latest cold simplicity review passed with no findings. It traced projectScene -> projectBlueprint -> paintSheet -> neutral CSS and confirmed the correction is one width change plus complete deletion of the datum concept; no further production code, abstraction, or test should be removed.
---

created: 2026-08-25 17:44
---
Verification after the cross-removal and width correction: bun run check passed (typecheck, 95 core tests, 150 viewer tests); task-scoped diff hygiene passed. In-app Browser QA at 1280x720 passed at fit and 195% zoom: no datum node exists, the narrower plate stays in the south/east band, the pencil opens a focused editor, Cancel closes it, and warning/error logs are empty.
---

author: @codex
created: 2026-08-25 17:50
---
Changed src/viewers/web/iso/blueprint.ts: replaced the fixed 44%-of-sheet title-plate width with content-fit geometry. The plate measures its visible name, metadata, and Markdown blocks, grows horizontally only up to an 80-character line, then wraps—including long unbroken text—while keeping the east anchor and south-only frame growth.
---

author: @codex
created: 2026-08-25 17:50
---
Changed test-bun/iso-map.test.ts: added projection invariants for a compact short profile, horizontal growth below 80 characters, a fixed width at the 80-character cap, wrapping on character 81, unchanged east alignment, and the existing south-only frame growth.
---

author: @codex
created: 2026-08-25 17:51
---
Changed docs/viewers/web/index.md: documented the content-fit title plate, its 80-character line threshold, and the invariant that wrapped content extends only the south frame edge.
---

author: @codex
created: 2026-08-25 17:51
---
Changed groma/observed/systems/groma/containers/web-viewer/components/iso-projection.md: the architecture record now assigns content-fit width, the 80-character line cap, wrapping, and south-only growth to the blueprint projection domain.
---

author: @codex
created: 2026-08-25 17:56
---
Updated design-qa.md with the latest user screenshot and real browser evidence. The fixed-width source and content-fit implementation were compared together; the short profile now produces a compact south-east plate, the pencil interaction remains focused and usable, browser logs are empty, and final result is passed.
---

author: @codex
created: 2026-08-25 17:57
---
Focused verification for the content-fit correction passed: 16 blueprint/page tests and task-scoped diff hygiene. Browser QA passed at 1280×720 fit view; the short profile produces a compact plate, Edit opens a focused dialog, Cancel closes it, and browser logs are empty. Repository-wide typecheck is temporarily blocked by unrelated shared TUI edits at src/viewers/tui/navigation-spatial.ts:165 and :172.
---

author: @codex
created: 2026-08-25 17:59
---
Applied the cold simplicity review to test-bun/iso-map.test.ts: removed the obsolete 45%-of-sheet plate-width assertion. The 60/80/81-character assertions are now the single authority for content-fit growth and capping.
---

author: @codex
created: 2026-08-25 17:59
---
Applied the cold simplicity review to the iso-projection architecture record: clarified that the content-fit rule includes the 80th character and wraps only beyond it. The reviewer found no production code or abstraction to remove.
---

author: @codex
created: 2026-08-25 18:01
---
Cold simplicity review passed after one cleanup: it traced projectScene → projectBlueprint → content measurement/wrapping → paintSheet, confirmed the production flow is the simplest clear approach, and found the domains easy for an unfamiliar developer to follow. Focused recheck passed (typecheck, 16 blueprint/page tests, task-scoped diff hygiene). The full check reached 95/95 core and 149/151 viewer tests; two unrelated shared-workspace tests remain failing in tree navigation and architecture-watch publication, and both failures reproduce without TASK-165 involvement.
---

author: @codex
created: 2026-08-25 18:13
---
Changed src/viewers/web/iso/blueprint.ts: increased the title-plate horizontal padding from half a scale unit to three quarters. Because the text inset stays at one quarter, the visible gutter before the pencil divider doubles while content measurement, the 80-character cap, and east/south anchors remain unchanged.
---

author: @codex
created: 2026-08-25 18:13
---
Changed test-bun/iso-map.test.ts: added a projection invariant that the rendered text measure ends with a real gutter before the pencil divider, alongside the existing content-fit and 80-character rules.
---

author: @codex
created: 2026-08-25 18:28
---
Applied the complexity review to src/project-markdown.ts: deleted the unused MarkdownSpan.href field and URL propagation. The SVG title plate still retains link styling; the editor Preview still renders real sanitized link destinations directly from the Markdown source.
---

author: @codex
created: 2026-08-25 18:28
---
Applied the complexity review to src/viewers/web/iso/blueprint.ts: plain and rich wrapping now share one chunksOf rule for long tokens. The plate now names contentInset and pencilGutter separately, preserving the approved geometry while making spacing edits explicit and safer.
---

author: @codex
created: 2026-08-25 18:29
---
Restored src/project-markdown.ts and parseProjectMarkdown to the project-profile architecture record after shared-workspace drift, so the SVG Markdown adapter is discoverable through its owning domain.
---

author: @codex
created: 2026-08-25 18:29
---
Corrected src/viewers/web/payload.ts documentation: WebMapPayload changes on architecture folds or project-profile saves, matching the existing generation and SSE contract.
---

author: @codex
created: 2026-08-25 18:30
---
Corrected src/viewers/web/iso/map.ts documentation: a project-profile publication also rebuilds the painted layers, not only an architecture change.
---

author: @codex
created: 2026-08-25 18:30
---
Reconciled TASK-165 traceability after the complexity review: added bun.lock for @comark/html and removed src/architecture-watch.ts because the watcher-based save approach was reverted and that file has no TASK-165 diff.
---

author: @codex
created: 2026-08-25 18:32
---
Restored the project-markdown ownership entry after stopping the active web scanner. The earlier restoration was immediately rewritten by the watcher after the TypeScript cleanup; no other agent's code was changed.
---

author: @codex
created: 2026-08-25 18:35
---
Superseding review note: comments claiming that src/project-markdown.ts was durably restored under project-profile are stale. The entry was attempted, but active watchScan folds correctly replace the complete Code list with the scanner's single src/project-profile.ts reference. TASK-173 confirmed there is no production multi-file candidate yet. TASK-165 keeps the scanner-authoritative record and treats multi-file grouping as a non-blocking scanner follow-up; no scanner code was changed.
---
<!-- COMMENTS:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Made the web sheet an editable grayscale project blueprint driven by groma/README.md. Added strict profile persistence with tolerant omission, sanitized Markdown Write/Preview, an isometric title plate and pencil, proportional compass and calibration decorations, content-fit width with an 80-character cap, south-only frame growth, direct save/SSE repaint, and domain-owned geometry/painting/editor boundaries. Verified with TypeScript, 23 focused tests, complete core and viewer evidence recorded in the task, real in-app Browser interaction and visual QA across light/dark and fit/zoom states, final simplicity and complexity reviews, and task-scoped diff hygiene.
<!-- SECTION:FINAL_SUMMARY:END -->
