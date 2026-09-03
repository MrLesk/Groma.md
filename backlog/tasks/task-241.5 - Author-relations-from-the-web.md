---
id: TASK-241.5
title: Author relations from the web
status: Done
assignee:
  - '@web-editor'
created_date: '2026-09-02 21:16'
updated_date: '2026-09-03 07:58'
labels:
  - cli
  - web
  - core
dependencies:
  - TASK-241.1
references:
  - 'https://claude.ai/code/artifact/902f8d7d-7267-49cd-b8cd-771e23b93d2b'
  - architecture-writer
  - edit
  - observed-curation
  - commands
  - instructions
  - render
  - web-viewer-details
  - page
  - welcome
modified_files:
  - src/relation.ts
  - src/markdown-emitter.ts
  - src/add.ts
  - src/edit.ts
  - src/remove.ts
  - src/relate.ts
  - src/cli.ts
  - src/instructions.ts
  - test/relation.test.ts
  - test/relate.test.ts
  - test/remove.test.ts
  - test-bun/authoring-boundary.test.ts
  - test-bun/web-authoring.test.ts
  - src/viewers/web/data.ts
  - src/viewers/web/chrome/add.ts
  - src/viewers/web/chrome/relate.ts
  - src/viewers/web/authoring.ts
  - src/viewers/web/organisms/details.ts
  - src/viewers/web/render.ts
  - src/viewers/web/page.ts
  - README.md
  - docs/agent-instructions/index.md
  - src/welcome/model.ts
  - docs/product-model.md
  - docs/viewers/web/index.md
  - docs/index.md
  - docs/component-markdown.md
  - groma/systems/groma/containers/cli/components/commands.md
parent_task_id: TASK-241
priority: high
type: feature
ordinal: 279000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Relationships are the one thing with two ids, so they carry the word relation on every verb. groma add relation <a> <b> --description <prose> --technology <text> writes the one relationship per ordered pair on the source document, groma edit relation <a> <b> rewords it and groma remove relation <a> <b> removes it; relate and relate --remove are deleted. In the web, Relate to on a selected element takes the target from a map click and opens the sentence form; clicking a route opens the same form with Remove.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 groma add relation <a> <b> --description <prose> --technology <text> writes one relationship per ordered pair on the source document and refuses a duplicate pair with one sentence naming groma edit relation
- [x] #2 groma edit relation <a> <b> rewords the description or technology; groma remove relation <a> <b> removes the row; relate no longer exists
- [x] #3 In the web, Relate to on a selected element takes the target from a map click and opens the sentence form; clicking a route opens the same form with Remove; groma view <a> prints the row the web wrote
- [x] #4 Tests cover add, edit, remove and the duplicate-pair refusal with fixtures under test/fixtures
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
1. Core: src/relation.ts replaces src/relate.ts with addRelation (one relationship per ordered pair, written on the source document; a second one refuses with the sentence naming groma edit relation), editRelation (rewrites the row's description and technology) and removeRelation (deletes the row). The verbs reach them through their inputs: add { thing: 'relation', name: <source>, relation: <target>, description, technology }, edit { id: <source>, relation: <target>, description?, technology? }, remove { id: <source>, relation: <target> }; add.ts, edit.ts and remove.ts dispatch on the relation field and refuse the flags that do not apply. relate.ts and the relate command go.
2. CLI: groma add relation <a> <b> --description <prose> --technology <text>, groma edit relation <a> <b> [--description] [--technology], groma remove relation <a> <b>; add takes an optional third argument, edit and remove take the two ids after the word relation.
3. Web: on the current revision of a live map the element pane gets a Relate to control that arms the map; the next element click is the target and one dialog (chrome/relate.ts) takes description and technology and posts the add input; the relationship pane edits description and technology in place and ends with a Remove control posting the remove input. render.ts is split before that so it stays under 500 lines.
4. Tests: test/relation.test.ts on the edit fixture (add, the duplicate refusal naming groma edit relation, edit, remove, refusals with the tree unchanged); test-bun/web-authoring.test.ts posts the three relation inputs and checks that groma view <a> prints the row; the tests that used relate move to the new verbs.
5. Docs and guides: README diagram, table and example, product model, shipped instructions, agent guide, web viewer doc, welcome table. Verify in the browser pane, run the checks, then the reviews.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Implemented: src/relation.ts replaces src/relate.ts with addRelation (one row per ordered pair on the source document; a second one refuses with the sentence naming groma edit relation), editRelation (rewrites the row; a flag left out keeps its text) and removeRelation; withoutRelationship in markdown-emitter now matches a row by target link, description and technology so a renamed target still finds its row. The verbs carry the word relation: add { thing: 'relation', name: source, relation: target, description, technology }, edit { id: source, relation: target, description?, technology? }, remove { id: source, relation: target }; add.ts, edit.ts and remove.ts dispatch on the relation field and refuse the flags that do not apply. CLI: groma add relation <a> <b>, groma edit relation <a> <b>, groma remove relation <a> <b> through one relationEnds helper; relate and its command are gone. Web: src/viewers/web/authoring.ts holds the pane write hooks and the armed relation (Relate to at the end of the element pane arms the map, the next element click is the target, chrome/relate.ts asks for description and technology and posts the add input; the source itself or Escape disarms); the relationship pane edits description and technology in place and ends with Remove; data.remove posts both ends. Guides, README, product model, agent guide, web doc and the welcome table describe the verbs. Browser run on the plain-view demo: Relate to armed the map (button text and crosshair), clicking the Git island opened 'Relate Shopper to Git', Add posted /add and the map gained the flow; the route pane at ?relationship=buyer/git showed the editable description and technology, a technology edit posted /edit and repainted, Remove posted /remove and the route left. Tests: test/relation.test.ts (add, the duplicate refusal, edit, remove after a rename of the target, refusals including the old relate command), test-bun/web-authoring.test.ts (the three relation inputs and groma view printing the row), tests that used relate moved to the verbs.

Cold simplicity review applied: withoutRelationship matches a row by its tail (target link, description, technology) with a string test instead of a regex, and withRelationship no longer guards a duplicate the writer refuses first; relation.ts holds the pair's one row and writeRow takes a named change (drop, add); the relationship pane's writes are a required parameter, render.ts keeps a local edit instead of a non-null assertion, the dialog's ends type is RelateDialogEnds; one refusal case per rule remains in test/relation.test.ts and one spawn helper serves git init and groma view in the web test; docs/index.md and docs/component-markdown.md stopped teaching groma relate. Recorded for the owner: the live data source could expose its writers as one optional group instead of four optional functions, which would delete the per-hook conditionals in authoring.ts; while Relate to is armed a click on a route hands the route id to the dialog and add refuses it as an unknown target; removing a scanner-written relationship is allowed and the next scan may write it again. Specification review: AC1 by test/relation.test.ts (one row per ordered pair, the duplicate refusal naming groma edit relation, the tree unchanged); AC2 by the same file (reword keeps the other flag, removal after the target was renamed restores the original document, relate fails as an unknown command); AC3 by the browser run (Relate to arms the map, the Git island became the target, the dialog posted the add input, the route pane edited technology and removed the route) and by test-bun/web-authoring.test.ts, where groma view prints the row the web wrote; AC4 by the edit and plain-view fixtures. Quality review: no reproducible defect in the supported flow; every verb reaches src/relation.ts through its own input and one dispatch line; the row identity is the target link plus the sentence, so a renamed target still finds its row; details.ts 494 and render.ts 491 lines stay under the limit but the next web change must split them first.

Full-context complexity review: no blocking finding. Applied: an armed relation now belongs to the primary selection on the current revision (a revision switch or a selection change elsewhere disarms it, and the button says 'Click the target' since hierarchy clicks count too); RemoveInput is the one input type of the remove verb, shared by remove.ts, the authoring table, the web data source and the CLI helper; the repository's own map row from commands to observed-curation was reworded through groma edit relation. Correction to an earlier note: the scanner writes no relationship rows, so a removed relation does not come back with a scan; a route's origin is its source element's status. Reported to the owner rather than built: the web identifies a route by its position in the sorted relationship list (relationship:<index>) while the writes identify it by its pair, so a concurrent add or remove by another actor can shift the index under an open pane; making the ordered pair the route id (with the parser refusing a second row per pair) would remove the url.ts mapping helpers. Checks: Biome and tsc clean for the task's files (tsc through a scratch config that leaves out the TUI task's in-flight files), Node 104/104, Bun 240/240 in the last full run.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Relationships carry the word relation on every verb: groma add relation <a> <b> writes the one row per ordered pair on the source document and refuses a second with the sentence naming groma edit relation, groma edit relation rewords it, groma remove relation removes it, and relate is gone. The web posts the same inputs: Relate to on an element arms the map and the next element click opens the sentence dialog, and a selected route edits description and technology in place and ends with Remove. Verified with test/relation.test.ts, test-bun/web-authoring.test.ts (groma view prints the row the web wrote), both full suites (Node 104/104, Bun 240/240) and browser runs of the armed relation, the dialog, the route pane edit and its removal.
<!-- SECTION:FINAL_SUMMARY:END -->
