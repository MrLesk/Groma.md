---
id: TASK-241.1
title: Store the architecture as one tree with drafts
status: Done
assignee:
  - '@web-editor'
created_date: '2026-09-02 21:16'
updated_date: '2026-09-02 22:33'
labels:
  - core
  - cli
dependencies: []
references:
  - 'https://claude.ai/code/artifact/902f8d7d-7267-49cd-b8cd-771e23b93d2b'
  - architecture-model
  - architecture-writer
  - okf-profile
  - architecture-reader
  - world-loader
  - create
  - architecture-comparison
  - edit
  - accept
  - observed-curation
  - plain-text-view
  - scan-lifecycle
  - architecture-watch
  - project-initialization
  - instructions
  - commands
  - welcome
  - iso-map
  - sheet-composition
  - init-command
modified_files:
  - src/types.ts
  - src/architecture-path.ts
  - src/okf-profile.ts
  - src/architecture-model.ts
  - src/architecture-reader.ts
  - src/core.ts
  - src/create.ts
  - src/architecture-comparison.ts
  - test/architecture-comparison.test.ts
  - src/markdown-emitter.ts
  - src/draft.ts
  - src/edit.ts
  - src/accept.ts
  - src/relate.ts
  - src/curate.ts
  - src/plain-world.ts
  - src/scan-reconciler.ts
  - src/architecture-watch.ts
  - src/initialize.ts
  - scripts/validate-architecture.ts
  - src/instructions.ts
  - src/cli.ts
  - src/welcome/model.ts
  - src/viewers/web/iso/style.ts
  - src/sheet/measure.ts
  - src/init-command.ts
  - groma
  - test/fixtures/containers-view
  - test/fixtures/core-view
  - test/fixtures/create
  - test/fixtures/edit
  - test/fixtures/openclaw-view
  - test/fixtures/plain-view
  - test/fixtures/validate
  - test/fixtures/viewer-view
  - test/architecture-model-helpers.ts
  - test/architecture-model-errors.test.ts
  - test/architecture-model.test.ts
  - test/architecture-reader.test.ts
  - test/accept.test.ts
  - test/create.test.ts
  - test/draft.test.ts
  - test/edit.test.ts
  - test/curate.test.ts
  - test/relate.test.ts
  - test/validate-architecture.test.ts
  - test/core.test.ts
  - test/cli-view.test.ts
  - test/scan-watch.test.ts
  - test/initialize.test.ts
  - test-bun/okf-writers.test.ts
  - test-bun/scanner-evidence.test.ts
  - test-bun/web-live.test.ts
  - test-bun/web-export.test.ts
  - test-bun/sheet-scene.test.ts
  - docs/product-model.md
  - docs/component-markdown.md
  - docs/index.md
  - docs/viewers/index.md
  - docs/viewers/creating-a-plugin.md
  - docs/scanners/index.md
  - docs/viewers/web/index.md
  - docs/agent-instructions/index.md
  - docs/historical-investigations.md
  - README.md
  - test/world-layout.test.ts
  - test/cli-helpers.ts
  - test/cli-scan.test.ts
parent_task_id: TASK-241
priority: high
type: feature
ordinal: 275000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Today groma/observed/, groma/plans/<id>/ and groma/missing/ hold three parallel C4 trees, and the folder decides whether an item is observed or planned while the frontmatter repeats it as status stable or draft. This slice makes the frontmatter the only lifecycle and lays the architecture out as one tree: groma/actors/, groma/externals/, groma/systems/ and groma/drafts/, plus index.md and project.md. A drafted element sits at its future C4 path with status draft and groma.draft naming its draft record in drafts/<id>.md; accept flips the status in the same file and keeps the tag, so one file tells the whole life of an idea. The draft tag may also sit on a stable element to say the draft touches it, which replaces the second document for a restated id. Externals leave systems/ for externals/ and actors leave observed/actors/ for actors/. The verb groma draft <kind> <name> replaces create --plan, create --observed is deleted, and every remaining "plan" in code, docs, shipped guides and Backlog text for this work becomes "draft". This repository tree and every fixture under test/fixtures are re-laid; nothing is migrated. By agreement with the terminal facelift, this slice starts after TASK-238.1 is committed, files under src/viewers/tui/** and test/fixtures/large-world are adapted by that agent from a message naming the new folders and frontmatter, and the generated large-world fixture is never edited by hand.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 groma/ holds one tree: actors/, externals/, systems/, drafts/, index.md and project.md; no observed/, plans/ or missing/ folder exists in this repository or in any fixture under test/fixtures
- [x] #2 Every element document carries OKF status draft or stable; a drafted element lives at its future C4 path with groma.draft naming its draft; drafts/<id>.md holds the draft title and outcome
- [x] #3 groma draft <system|container|component> <name> --parent <id> --overview <markdown> [--draft <id>] writes the ghost with the kind checked against the parent; create and --observed no longer exist
- [x] #4 groma accept <id> flips status in the same file and keeps the draft tag; groma edit <id> --draft <id> tags an existing element; no second document is written for a restated id
- [x] #5 The scanner writes only under systems/ and never changes status, tags, titles, prose, parents, groups or relationships; two consecutive scans of this repository create no element and change no curated field
- [x] #6 The web map, the terminal map, groma view --plain and export draw drafts as ghosts from status, never from a folder, and list the same elements as before the re-lay
- [x] #7 The word "plan" appears nowhere in src, docs, shipped guides or the CLI help; files keep the OKF words draft and stable
- [x] #8 Tests load fixtures only from test/fixtures in the new layout and bun run check passes
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
1. Types: Origin becomes observed | draft; Revision, RevisionDescriptor and RevisionRecord go; loadArchitecture returns { documents, drafts } read from one tree; ArchitectureElement gains status and draft, external derives from the externals/ folder; AnnotatedArchitectureModel.plans becomes drafts and element.plan becomes element.draft.
2. Reader and model: one recursive listing of the Groma directory, index.md and project.md as the only reserved root documents, drafts/*.md as draft records (type Draft, title, groma.id, outcome as lead prose), location patterns actors/, externals/, systems/; status is required and is the lifecycle; a container under an external is refused.
3. Paths and emitter: architectureElementPath chooses externals/ for external systems and drops the observed prefix; renderArchitectureDocument writes groma.draft and no external field; writeObservedDocument becomes writeDocument; setOutcomeSection goes.
4. Writers: create.ts is deleted; draft.ts writes a ghost at its future path (kind checked against parent, optional --draft naming an existing record); edit gains --draft as a tag and loses --plan and restatement, draft records take --overview; curate keeps each element status; relate resolves any element; accept flips status in place and keeps the tag; the scanner writes under systems/ and reads status.
5. CLI, guides, welcome, watch, validate script: draft <kind> <name> replaces create; accept and view wording; watcher covers the whole Groma directory; validation counts one tree.
6. Web viewer: ghost class draft replaces planned, missing style goes; sheet comments follow.
7. Re-lay this repository tree and the fixtures under test/fixtures (large-world excluded, its generator is adapted by the TUI agent from a message) with a scratch script that moves files, rewrites relative links, tags former plan documents and folds restated duplicates into a tag; then rewrite the affected tests.
8. Docs and guides: replace plan with draft in product-model, component-markdown, index, web viewer docs, README and CLAUDE.md; ask the TUI agent to do the same in docs/viewers/tui.
9. Verify: focused node and bun tests, two clean scans of this repository, groma view --plain parity with the pre-change output, bun run check; cold simplicity review, spec and quality review, full-context review; commit with the task subject.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Storage rewritten: one tree (actors/, externals/, systems/, drafts/), OKF status as the only lifecycle, groma.draft tag, draft records as drafts/<id>.md, create.ts and the second document for a restated id deleted, groma draft replaces create --plan, accept flips status in place. This repository tree and eight fixtures re-laid with a scratch script (relative links rewritten, restated duplicates folded into a tag); the large-world fixture generator was re-laid by the TASK-238 agent by agreement. Stale records for the deleted src/create.ts and src/architecture-comparison.ts removed; the scanner-created draft component was placed under cli through groma edit and related through groma relate, which also exercised the new write paths on the live tree.

Verification so far: bun run check green (Biome 18 pre-existing complexity warnings, TypeScript clean, Node 87/87, Bun 219/219); two consecutive groma scan runs on this repository: created 1 then created 0, refreshed 68 then 69, identical tree hash after both; no observed/, plans/ or missing/ folder remains under groma or test/fixtures; every element document carries status draft or stable; groma view --plain on the plain-view fixture prints the drafts section; groma --help and the draft, edit, accept, view and relate help texts contain no plan wording; test-bun/web-live.test.ts passes alone (8/8) after a contention timeout in a concurrent run.

Cold simplicity review (separate agent, no history): no blocking findings, no defect. Accepted and applied: removed the unused draftRecordPath, renderDraftDocument and the external parameter of architectureElementPath; collapsed the draft-id check into requireDraftRecord next to draftRecordOf and dropped the two duplicate non-kebab test cases; un-exported rootKinds and originOf; clarified the ArchitectureRecords comment; moved the duplicated run, groma, writeTree, readTree, readRelative and copyFixture helpers of seven Node tests into test/cli-helpers.ts; refreshed the eight live records whose prose still described plans and the removed second document (coding-agent, human-architect, groma, accept, cli, plain-text-view, edit, architecture-watch) through groma edit and groma relate. Recorded as follow-ups, not in this slice: the scanner reconciler re-derives id, kind, parent, status and code from raw documents instead of reading buildArchitectureModel elements; representationId now always equals id and can be removed once the terminal viewer stops keying on it; a name whose kebab-case is empty would let groma draft write an invalid id.

Specification review: AC1 ls groma shows actors, drafts, externals, index.md, project.md, systems and no observed, plans or missing folder exists under groma or test/fixtures (find count 0). AC2 every element document carries status draft or stable (grep -L empty), ghosts carry groma.draft, drafts/<id>.md holds title and outcome. AC3 test/draft.test.ts covers the ghost path, kind versus parent, the optional draft record and the refusals; groma create is an unknown command. AC4 test/accept.test.ts proves the in-place status flip with the tag kept, test/edit.test.ts proves the tag on a stable element, and no writer produces a second document since restateElement is gone. AC5 the scanner writes under systems only and two consecutive scans of this repository produced created 0 with an identical tree hash. AC6 origin is derived from status in core (test/core.test.ts), the web styles ghosts by the draft class, the terminal viewer reads origin draft (TASK-238 agent, its tests green in the full check), and groma view --plain lists the same elements apart from the two records for deleted source and the records new code gained. AC7 no Groma-concept plan wording remains in src, docs, shipped guides or CLI help; the only remaining matches are English uses: the agent nudge "before planning", the README etymology line, and Backlog's "Implementation plan" field label. AC8 fixtures load only from test/fixtures and bun run check passed.

Quality review: no reproducible defect found in the supported flow; ownership is clear (reader, model, writers, scanner); tests cover every new behaviour and refusal; the remaining complexity warnings are pre-existing and outside the changed files.

Full-context complexity review (separate agent): two defects inside the acceptance criteria, both fixed with tests in test/draft.test.ts: groma draft accepted a name whose kebab-case is empty and wrote a document with an empty id that made the whole tree unreadable (now refused: name must contain a letter or a digit), and it accepted an id that already named a draft record, after which edit and view resolved the element and the record became unreachable (now refused). It also showed draft overwriting an existing document at the destination path when that document carried another id; the destination is now refused when it exists, as curate already did. Material recommendations for the owner, not applied: define when a drafted container or system counts as scan-matched, since the scanner attaches code only to components and accept therefore never accepts them; make buildArchitectureModel the single parser so the scan reconciler and init stop reading raw frontmatter leniently; enforce one id namespace across elements and draft records, and file name equals id, in the model rather than in each writer; carry DraftRecord objects in the annotated model instead of draft ids so printers and the web stop re-reading raw records. Other non-blocking notes: the externals location check derives external from the path it then validates, requireDraftRecord throws a plain Error from the model module, readCode duplicates code-reference.ts, and the live record titled Observed curation keeps its old name until edit gains --title.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Replaced the observed, plans and missing folders with one tree under the Groma directory (actors/, externals/, systems/, drafts/) where the OKF status is the only lifecycle, a ghost is a draft document at the path it will keep, groma.draft tags an element with its draft record, and accept flips the status in place. groma draft <kind> <name> replaces create; create, --observed, the restated second document and the missing revision are gone; the scanner writes only under systems/; every plan word in code, guides, docs and README became draft. This repository and eight fixtures were re-laid, the live records refreshed, and three review defects in draft (empty id, id colliding with a draft record, overwriting an occupied path) fixed with tests. Verified by bun run check (TypeScript clean, Node 87/87, Bun 218/218, only pre-existing Biome warnings), two consecutive scans with created 0 and an identical tree hash, no old folder under groma or test/fixtures, every element carrying a status, and plan-free CLI help and guides.
<!-- SECTION:FINAL_SUMMARY:END -->
