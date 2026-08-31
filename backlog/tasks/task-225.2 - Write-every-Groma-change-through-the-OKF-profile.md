---
id: TASK-225.2
title: Write every Groma change through the OKF profile
status: Done
assignee:
  - '@codex'
created_date: '2026-08-30 21:44'
updated_date: '2026-08-31 00:50'
labels: []
milestone: m-5
dependencies:
  - TASK-225.1
references:
  - architecture-writer
  - architecture-model
  - create
  - edit
  - observed-curation
  - scan-lifecycle
  - accept
  - project-profile
  - commands
  - instructions
  - project-editor
modified_files:
  - src/markdown-emitter.ts
  - src/architecture-markdown.ts
  - src/create.ts
  - src/edit.ts
  - src/curate.ts
  - src/scan-reconciler.ts
  - src/accept.ts
  - src/project-profile.ts
  - test-bun/okf-writers.test.ts
  - src/cli.ts
  - src/instructions.ts
  - src/viewers/web/project/editor.ts
parent_task_id: TASK-225
priority: high
type: feature
ordinal: 240000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Make Groma the single safe writer of its OKF profile. Creating, editing, scanning, restating, accepting, and saving project context must update only fields Groma owns while retaining the complete valid OKF document.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Create and scan emit standard OKF metadata and the nested Groma profile without writing the retired kind contract
- [x] #2 Edit, scan refresh, restatement, acceptance, and project-context saving preserve unknown and standard OKF metadata plus unowned Markdown content
- [x] #3 Planned representations use OKF draft lifecycle state and accepted observed representations use stable without inventing human verification
- [x] #4 Indexes and profile markers remain correct after supported Groma write operations
- [x] #5 Focused lifecycle and writer tests cover create, edit, scan, restate, accept, and project-context behavior
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
1. Make the existing Markdown writer emit canonical OKF C4 concepts: top-level type/title/optional description/status, one nested groma mapping, no duplicate H1, and profile-scoped mutations that preserve unowned frontmatter and Markdown.
2. Directly replace authoring vocabulary across TASK-225.2: `overview` always owns leading Markdown body prose and `description` always owns the optional concise top-level OKF field. Create/edit CLI use --overview for the existing long-body capability and --description only for the standard field, with omission preserving and an explicit empty edit clearing description.
3. Move create and revision scaffolding to the reader’s reserved index.md convention; emit draft planned concepts and stable observed concepts while retaining the root OKF declaration and Groma project marker.
4. Route edit, structural curation, restatement, scan creation/refresh/matching, and acceptance through owned-field mutations; preserve unknown/standard metadata and change only lifecycle status, Groma metadata, explicitly submitted description, or the explicitly edited overview/body section.
5. Save project context to groma/project.md with title/overview/description vocabulary, preserving its Groma profile marker, trust/provenance, and unknown keys.
6. Apply the authority-backed TASK-225.1 boundary correction for scanned concepts: allow an absent leading overview and expose it as the empty string, without placeholder prose or derived description.
7. Add minimum isolated writer/command tests for create, edit, restate, scan, accept, project save, lifecycle, reserved indexes/profile marker, description omission/change/clear, and metadata/body preservation. Run focused suites, typecheck, targeted lint, file-size and diff checks; run bun run check only if the remaining TASK-225.3 migration boundary is coherent.

8. Apply the accepted cold-review deletions only: remove duplicate project input parsing, leave lifecycle status with each final writer, delete decorative help-prose assertions, then rerun directly affected checks without entering the TASK-225.3 migration boundary.

9. Apply the accepted final hot-review cleanup only: centralize submitted description semantics in withDescription, name nested-profile mutations withGromaField and withGromaCode, reuse requireGromaMapping, then rerun affected proof without adding behavior or tests.

10. Close the completion-audit gap by permanently asserting standard and unknown metadata preservation through restatement, scan refresh, and structural curation; change production code only if those behavior assertions expose a failure, then rerun review and repository gates.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Research found one required read-side boundary correction: scan has always created concepts without authored overview text, while TASK-225.1 made leading prose mandatory. The parent confirmed that OKF permits an empty body and authorized overview: "" for this reproduced supported scan flow. TASK-225.2 will make the smallest correction, with no placeholder, derived description, provenance, trust, or human claim.

Changed src/markdown-emitter.ts: new C4 documents now serialize top-level OKF type/title/status plus one nested groma mapping and no H1. Profile updates parse and reserialize frontmatter so unknown standard keys survive while code, parent, group, or lifecycle status change; body edits retain the existing frontmatter and named-section suffix.

Changed src/architecture-markdown.ts under the parent-approved TASK-225.1 boundary correction: a C4 concept with no leading prose now has overview ""; existing consecutive leading paragraphs and named-section exclusion remain unchanged.

Changed src/create.ts: id/kind indexing now reads type plus groma.id; observed creation maintains observed/index.md; first plan use creates plans/<id>/index.md with no frontmatter; created C4 concepts use stable for observed and draft for planned.

Changed src/edit.ts: indexes stable ids from groma.id, uses plan/index.md, restates by removing only groma.code and setting draft, and sets stable/draft when editing the observed/planned owner while preserving its other frontmatter and named Markdown sections.

Changed src/curate.ts: structural edits now mutate groma.group, groma.parent, and groma.code, set rewritten observed representations stable, preserve all other metadata/body content, and treat only a truly empty OKF body as unauthored scanner output.

Changed src/scan-reconciler.ts: scanner-created concepts emit the OKF profile with stable status and an empty body; code refresh/matching updates only groma.code plus the correct observed stable or planned draft lifecycle state.

Changed src/accept.ts: ghost identity and scan evidence come from groma.id/code; acceptance preserves the planned concept’s complete metadata and Markdown while changing only lifecycle status to stable before moving it into observed.

Changed src/project-profile.ts: saving now updates groma/project.md, preserves the required type/profile marker, optional description, trust/provenance, and unknown frontmatter, and replaces only the submitted standard title and complete overview body. The retired groma/README.md save path is removed.

Added test-bun/okf-writers.test.ts: six isolated concurrent tests cover canonical create, stable/draft lifecycle, edit/restatement, structural Groma metadata, scan refresh/create/empty overview, scan match plus accept, reserved indexes/root marker, project-profile save, and preservation of optional description, provenance, audience, unknown metadata, and named Markdown sections.

Contract correction from the parent: the first implementation pass retained the retired CLI variable meaning in which `description` held body prose. That is not accepted. The final implementation will expose --overview for long Markdown and --description only for optional top-level OKF description across external and internal authoring inputs, with no alias or compatibility path. Omitted description preserves; explicit empty edit clears because Commander retains undefined versus an explicitly supplied empty string.

Changed src/cli.ts for the corrected authoring contract: create requires --overview and accepts optional --description; edit exposes independent --overview and --description, with the latter documented as removable by an explicit empty value. No old --description-as-body alias remains.

Changed src/instructions.ts: shipped authoring examples now use --overview for long body/plan outcome and --description only for the optional concise OKF field, including preserve-on-omission and explicit-empty removal semantics.

Changed src/viewers/web/project/editor.ts: form and payload now use title, optional concise description, and Markdown overview as distinct fields. The map continues to render profile.overview; no new descriptive display copy was added.

Final authoring vocabulary proof: create CLI requires --overview for leading body Markdown and accepts --description for the optional top-level OKF field. Edit CLI exposes both independently. Commander passes an omitted description as undefined, so edit and project-profile save preserve it; an explicitly supplied empty string reaches the writer and removes the top-level key. The same overview/description names are used by create, edit, curate, project-profile, and the web project editor; no compatibility alias translates description into overview.

Final writer flow: create writes canonical draft planned or stable observed C4 documents and maintains plans/<id>/index.md or observed/index.md. Edit changes only submitted title, top-level description, leading body overview, or nested Groma structural/code fields and applies the owner lifecycle. Restate copies the complete observed document, removes only nested groma.code, sets draft, and changes only submitted author fields. Scan creates stable observed documents with empty overview, refreshes only nested code plus lifecycle, and marks a matching planned representation draft. Accept changes only top-level status to stable before moving the accepted representation. Project-profile save changes submitted title/description/body overview in groma/project.md while preserving type, groma.profile, trust/provenance, unknown metadata, and reserved indexes.

Final focused proof after the vocabulary correction: test-bun/okf-writers.test.ts now has eight concurrent tests and passes 8/8 with 75 assertions. bun run typecheck passes. Targeted Biome over all twelve TASK-225.2 source/test files passes. The architecture model, project profile, and instruction suites pass 15/15. git diff --check passes and every modified source/test file is at most 500 lines.

The combined shared tree is not yet coherent for bun run check because TASK-225.3 owns migration of the complete live groma package and broad fixture corpus. A targeted run of the pre-existing broad create/edit/curate/accept/scan/project/instruction suites produced 9 passes and 26 failures: old fixtures lack reserved groma/index.md and still encode README, kind, duplicate-H1, and --description-as-body contracts. No compatibility reader, alias, fallback, or corpus migration was added in TASK-225.2.

Strengthened the end-to-end CLI proof: an edit that omits --description preserves the existing top-level description, then a separate --description empty edit removes it without changing the body overview.

Final rerun after the CLI omission assertion: the dedicated writer suite passes 8/8 with 78 assertions; typecheck, targeted test lint, git diff --check, and the 484-line test-file size check also pass.

Cold review: deleted projectProfileInput. saveProjectProfile now validates the submitted shape once with requireProfileInput and relies on parseProjectProfile as the single final parse and rendered-document validation.

Cold review: omitCode now owns only removal of nested groma.code; its unused optional lifecycle parameter was deleted.

Cold review: restatement now removes code without assigning lifecycle there; editedElementSource remains the one owner that assigns draft to the final planned representation.

Cold review: group, target move, and target combine helpers no longer assign stable redundantly. curateObserved still assigns stable once to the final target rewrite, and a child moved during container combination still receives its required stable lifecycle assignment.

Cold review: deleted only the three decorative CLI help-prose assertions. Tests retain the public --overview and --description option-name checks plus end-to-end omission, preservation, body ownership, and explicit clearing behavior.

Cold-review verification: the dedicated OKF writer suite passes 8/8 with 75 business assertions after deleting the three prose-only assertions; project-profile tests pass 3/3; typecheck and targeted Biome over the five affected files pass; git diff --check passes. Affected file sizes are project-profile 79, markdown-emitter 268, edit 276, curate 311, and writer tests 481 lines. Searches find no projectProfileInput or multi-argument omitCode. Inspection confirms the final target stable write and required moved-child stable write remain.

Final hot review: markdown-emitter now uses withDescription as the single owner of submitted description semantics: undefined returns the source unchanged, empty removes top-level description, and nonempty replaces it. Nested profile helpers are named withGromaField and withGromaCode. withGromaChange reuses requireGromaMapping instead of private duplicate validation.

Final hot review: edit now passes the submitted description directly to withDescription and has no local omission guard or empty-string translation.

Final hot review: curation now calls withDescription directly and uses withGromaField/withGromaCode for every nested profile mutation; its duplicated description guard and empty translation were deleted.

Final hot-review verification: the existing OKF writer suite passes 8/8 with 75 assertions, including description omission/change/clear; architecture-model tests pass 6/6; typecheck and targeted Biome over markdown-emitter, edit, and curate pass; git diff --check passes. Files are 259, 271, and 306 lines, with the unchanged writer test at 481. Search finds no retired helper names, private gromaMapping, or caller-side empty-description translation. No test, behavior, compatibility, or TASK-225.3 file was added.

Final writer reviews: PASS. Cold review removed duplicate project parsing, repeated lifecycle assignments, and decorative help prose. The full-context review centralized description preserve/remove/replace semantics, named nested Groma mutations explicitly, and reused the shared Groma mapping validator. Writer tests pass 8/8 with 75 assertions, and the complete final repository check passes Node 91/91 and Bun 207/207.

Post-completion audit reopened this task because preservation was implemented and partially tested, but restatement, scan refresh, and structural curation did not each assert the full standard/unknown metadata set. This is an evidence gap against AC #2 and AC #5, not authorization for new behavior.

Completion-audit evidence fix in test-bun/okf-writers.test.ts: restatement now asserts the complete remaining groma mapping plus preserved description, provenance, audience, and named Markdown; structural curation asserts group changed while id, parent, code, description, provenance, audience, overview, and named Markdown remain; scan refresh asserts updated code/lifecycle while description, provenance, audience, and named Markdown remain. No production file changed.

Completion-audit verification: the writer suite passes 8/8 with 83 assertions; typecheck, targeted Biome for the changed test, 490-line file-size check, and git diff --check pass. No production code changed. The required full bun run check was attempted twice and reached 89/91 Node tests, but the two unrelated scan-watch tests failed because the host returned EMFILE: too many open files; an isolated sequential rerun reproduced the same resource failure. The changed writer suite is green and no TASK-225.3 or scan-watch file was touched.

Completion-audit final evidence: the cold simplicity review and full-context defensive-architecture review both passed. The exact candidate tree passes bun run check with Node 91/91 and Bun 207/207. The focused writer suite passes 8/8 with 83 assertions; typecheck, targeted Biome, the 490-line file limit, git diff --check, and Groma validation at 69 elements/69 relationships pass. Pinned Google commit ad30107c31c06aec8a7d5636e0d1058118604e6f validates 140 concepts and 40 indexes across nine packages; its reference visualizer loads 70 live concepts, 69 Markdown bodies, and 69 edges with zero invented trust/provenance fields. The follow-up changed only preservation assertions in test-bun/okf-writers.test.ts; production code is unchanged.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Completed the OKF writer profile and its permanent preservation proof. Restatement, structural curation, and scan refresh now explicitly guard standard, unknown, Markdown, and nested Groma metadata ownership; cold and full-context reviews passed, the full repository check passes 91 Node and 207 Bun tests, and pinned Google validation passes 140 concepts across nine packages.
<!-- SECTION:FINAL_SUMMARY:END -->
