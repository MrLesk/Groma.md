---
id: TASK-241.3
title: 'Add and remove actors, externals, drafts and ghosts'
status: Done
assignee:
  - '@web-editor'
created_date: '2026-09-02 21:16'
updated_date: '2026-09-03 06:49'
labels:
  - cli
  - web
  - core
dependencies:
  - TASK-241.1
references:
  - 'https://claude.ai/code/artifact/902f8d7d-7267-49cd-b8cd-771e23b93d2b'
  - web-viewer-details
  - render
  - web-server
  - page
  - instructions
  - welcome
  - architecture-model
  - draft
  - architecture-reader
  - scan-lifecycle
modified_files:
  - src/removable.ts
  - src/add.ts
  - src/remove.ts
  - src/architecture-path.ts
  - src/markdown-emitter.ts
  - src/cli.ts
  - src/viewers/web/chrome/theme-control.ts
  - src/viewers/web/chrome/add.ts
  - src/viewers/web/organisms/remove.ts
  - src/viewers/web/organisms/details.ts
  - src/viewers/web/render.ts
  - src/viewers/web/data.ts
  - src/viewers/web/server.ts
  - src/viewers/web/page.ts
  - test/add.test.ts
  - test/remove.test.ts
  - test-bun/web-authoring.test.ts
  - docs/product-model.md
  - README.md
  - src/instructions.ts
  - docs/agent-instructions/index.md
  - docs/viewers/web/index.md
  - src/welcome/model.ts
  - src/architecture-model.ts
  - src/naming.ts
  - src/draft.ts
  - test-bun/inspect-details.test.ts
  - src/architecture-reader.ts
  - src/scan-reconciler.ts
parent_task_id: TASK-241
priority: high
type: feature
ordinal: 277000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
People declare what no scan can see. groma add actor <name>, groma add external <name> and groma add draft <name> write stable records under actors/ and externals/ and the draft record under drafts/; groma add component <name> refuses with one sentence that names groma draft, because scanned software is never hand-created. groma remove <id> takes the id alone, since ids are unique: it removes a person, an external, a ghost or an empty draft, refuses while routes point at the element or ghosts carry the draft tag and names them, and refuses on a stable system, container or component naming the scanner as the owner. The web mirrors it: a plus button in the hierarchy pane offers Person, External and Draft, and the details pane shows Remove only where the verb would succeed. Each control posts the same input the CLI builds and shows the same refusal sentence.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 groma add actor <name> --overview <markdown> and groma add external <name> --technology <text> --overview <markdown> write stable records under actors/ or externals/ and print ok and the id
- [x] #2 groma add draft <name> --overview <markdown> writes drafts/<id>.md and prints ok and the id
- [x] #3 groma add system|container|component <name> fails with one sentence naming groma draft and writes nothing
- [x] #4 groma remove <id> removes an actor, an external, a ghost or an empty draft; it refuses and names the blockers while routes point at the element or ghosts carry the draft tag; on a stable system, container or component it refuses and names the scanner as the owner
- [x] #5 The web hierarchy pane offers Person, External and Draft from one plus button, each posting the same input as the CLI; the details pane shows Remove only where the verb would succeed and shows the CLI refusal sentence otherwise
- [x] #6 Tests cover every add target, the teaching error and every remove refusal with fixtures under test/fixtures
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
1. Core: src/add.ts writes a stable actor under actors/, a stable external under externals/, or a draft record under drafts/ from one AddInput { thing, name, overview, description?, technology? }; a scanned kind refuses with the sentence that names groma draft. The id comes from freeId in architecture-model.ts (kebab id, free among elements and draft records, not a reserved document name), shared with groma draft, and requireText in naming.ts checks the required flags for both writers; the path must be unoccupied. src/removable.ts holds the pure rules the CLI and the web use on the annotated graph: removalBlocker (scanner-owned stable software, children, elements that relate to it) and draftRemovalBlocker (ghosts still carrying the tag). src/remove.ts applies them, deletes the document, and for a draft record clears the tag from the stable elements that carried it. markdown-emitter regains renderDraftDocument and architecture-path regains the externals branch and takes over isReservedDocument, so the model no longer imports the reader.
2. CLI: groma add <thing> <name> --overview [--description] [--technology] and groma remove <id> print ok and the id or one sentence and exit 1.
3. Server: POST /draft, /add and /remove sit in one write map beside the route map; one writeResponse runs the core writer on the posted body, publishes the world, and answers { id } or the core sentence with 400.
4. Web: the hierarchy pane gets a plus button opening one dialog (Person, External system, Draft; name, overview, technology only for an external) that posts the same input as the CLI; the details pane shows a Remove control with an inline confirm only where removalBlocker allows it and only on the current revision, and shows the server sentence if the write is refused; the plus button hides while a past revision is shown; data.ts gains add and remove; the theme control moves to chrome/theme-control.ts, binds at boot, and keeps render.ts under 500 lines.
5. Tests: test/add.test.ts and test/remove.test.ts through the CLI on the plain-view fixture, including every refusal with the tree unchanged; test-bun/web-authoring.test.ts for POST /add, POST /remove and their refusals; test-bun/inspect-details.test.ts for the pane's Remove gate.
6. Docs and guides: product-model, README table and prose, shipped instructions, agent guide, web viewer doc, welcome command table. Verify in the browser pane, run the checks, then the reviews.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Implemented: src/add.ts (addThing) writes a stable actor, a stable external or a draft record from one AddInput; a scanned kind refuses with the sentence naming groma draft; ids must be free among elements and drafts, not reserved, and the path unoccupied. src/removable.ts holds removalBlocker and draftRemovalBlocker on the annotated graph, shared by src/remove.ts (removeThing, which also clears the tag from stable elements when a draft record goes) and by the web details pane. CLI: groma add <thing> <name> and groma remove <id>. Server: one POST /<verb> dispatch over draft, add and remove with one wrapper. Web: the hierarchy pane plus button opens one dialog (Person, External system, Draft; technology field only for an external) posting the CLI input; the details pane ends with a Remove control (ask, then confirm, refusal sentence inline) only where removalBlocker allows; the theme control moved to chrome/theme-control.ts so render.ts stays under 500 lines. Guides, docs, README and the welcome command table describe add and remove.

Verification so far: tests in test/add.test.ts, test/remove.test.ts and test-bun/web-authoring.test.ts pass (every add target, the teaching sentence, every remove refusal with the tree unchanged, the removal rules on a hand-built graph, POST /add and /remove with their refusal sentences); a first draft of the remove tests assumed the plain-view stock was a ghost, but the re-lay had folded it into a stable tagged component, so the tests now draft their own ghost.

Browser verification on a git-initialized copy of the plain-view fixture served by groma web: the plus button opens the dialog, adding Person 'Support agent' with an overview lists it under Actors and stands its island on the map (element count 7 to 8); selecting it shows Remove, which asks 'Remove Support agent?' and on confirm removes it from the hierarchy and the map (count back to 7) and closes the details pane; selecting the scanned system shows no Remove control. The first browser run crashed at boot because the theme control reported its initial paint through the URL sync while the control was still being created; the control now paints on creation and reports only on click. Full check: Biome has no warning in the task's files (the 22 warnings are the pre-existing ones plus the TUI facelift's in-flight files), tsc fails only on src/viewers/tui/navigation.ts which the TUI task owns, Node 101/101 and Bun 229/229 pass when run directly.

Cold simplicity review applied: the server's verb table became a write map beside the route map (explicit paths, no key lookup on inherited names); the free-id rule (kebab id, not an element or draft id, not reserved) now exists once as freeId in architecture-model.ts and requireText once in naming.ts, shared by add and draft; the hand-built-graph test left test/remove.test.ts (the CLI tests on the fixture make every claim) and the pane's Remove gate is asserted in test-bun/inspect-details.test.ts; the refused-write web test no longer performs a successful write; the add dialog's Set and cast, the non-null assertion in render.ts and the post name in data.ts went. Skipped as a non-blocking follow-up: sharing the dialog card CSS with the empty-state card. Specification review: AC1 to AC3 are proven by test/add.test.ts (actor and external records with ok and the id, the draft record, the teaching sentence with the tree unchanged), AC4 by test/remove.test.ts (every refusal with the tree unchanged, the ghost and the draft record leaving in order), AC5 by test-bun/web-authoring.test.ts, test-bun/inspect-details.test.ts and the browser run, AC6 by the plain-view fixture under test/fixtures. Quality review: no reproducible defect in the supported flow; removal rules live in one node-free module used by the CLI and the pane; the web posts the CLI input verbatim; outgoing relationship rows leave with the removed file and incoming ones block the removal; every file stays under 500 lines.

Full-context complexity review: one in-scope defect, the plus button and the Remove control stayed live while a past revision was shown, so a confirm would have written to the live tree with no visible result; now the pane offers Remove only on the current revision and the plus button hides with the body's revision attribute, matching the project pencil and the empty-state invitation. Solidity: the theme control binds with the other boot-time reads so the URL sync never meets an unbound control; the reserved-name rule moved from the reader to architecture-path.ts so the model stays free of the reader. Reported to the owner rather than built: removing a ghost system or container leaves its empty folder on disk (git ignores it; loading and scanning are unaffected); the --technology guard on non-externals has no acceptance criterion; the CLI write commands repeat one try/ok/catch block that a shared runner could collapse.

Validation passed after the final review fixes: Biome clean on the task's 25 TypeScript files, tsc clean outside src/viewers/tui/navigation.ts (owned by the TUI facelift task), Node 100/100, Bun 234/234. Browser: on a past revision the plus button is hidden and a person shows no Remove control; on the current revision add and remove work as recorded above.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
groma add <thing> <name> declares a person, an external or a draft record and refuses scanned kinds with the sentence that names groma draft; groma remove <id> removes a person, an external, a ghost or an empty draft record and names what blocks it otherwise. The web mirrors both through the same core writers: a plus-button dialog in the hierarchy pane and a Remove control in the details pane that appears only where the verb would succeed, on the current revision only. Verified with test/add.test.ts, test/remove.test.ts, test-bun/web-authoring.test.ts, test-bun/inspect-details.test.ts, the full Node and Bun suites, and browser runs of add, remove, the refusal gate and the past-revision guard.
<!-- SECTION:FINAL_SUMMARY:END -->
