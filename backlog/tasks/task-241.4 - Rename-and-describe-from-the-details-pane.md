---
id: TASK-241.4
title: Rename and describe from the details pane
status: Done
assignee:
  - '@web-editor'
created_date: '2026-09-02 21:16'
updated_date: '2026-09-03 07:28'
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
  - commands
  - web-server
  - render
  - project-editor
  - revision-history
  - web-viewer-details
  - page
  - welcome
  - instructions
modified_files:
  - src/markdown-emitter.ts
  - src/edit.ts
  - src/remove.ts
  - src/authoring.ts
  - src/cli.ts
  - src/architecture-path.ts
  - src/viewers/web/server.ts
  - src/viewers/web/data.ts
  - src/viewers/web/render.ts
  - src/viewers/web/project/editor.ts
  - src/viewers/web/chrome/add.ts
  - src/viewers/web/chrome/empty.ts
  - test-bun/web-live.test.ts
  - test-bun/web-authoring.test.ts
  - test-bun/authoring-boundary.test.ts
  - test/edit.test.ts
  - src/viewers/web/revision/control.ts
  - src/viewers/web/payload.ts
  - src/viewers/web/runtime.ts
  - src/viewers/web/organisms/editable.ts
  - src/viewers/web/organisms/code-lists.ts
  - src/viewers/web/organisms/details.ts
  - src/viewers/web/page.ts
  - test-bun/web-map-debug.test.ts
  - README.md
  - docs/product-model.md
  - docs/viewers/web/index.md
  - src/welcome/model.ts
  - docs/agent-instructions/index.md
  - src/instructions.ts
parent_task_id: TASK-241
priority: high
type: feature
ordinal: 278000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
A title cannot change anywhere today, and the project popover is the only web write, posting to PUT /project with no CLI twin. groma edit <id> gains --title and --technology and reaches the reserved id project, so groma edit project --title --overview edits groma/project.md and the popover posts the same input. In the web details pane, title, description, overview and technology are editable in place and a Draft selector tags the element with a draft; each control posts the same input the CLI builds, and a refusal appears under its field. The web reaches core through one route per verb, each taking the input type the CLI builds from its flags, and one guard test keeps the CLI and the web importing writes only from one core authoring module.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 groma edit <id> --title <text> renames any element or draft record without changing its id; --technology <text> sets the technology; --draft <id> tags the element
- [x] #2 groma edit project --title <text> --overview <markdown> edits groma/project.md; the web project popover posts the same input; PUT /project is gone
- [x] #3 In the web details pane, title, description, overview and technology are editable in place and a Draft selector tags the element; a refusal sentence appears under the field it belongs to
- [x] #4 One route per verb accepts the same input type the CLI builds; a test asserts that no viewer file imports the write modules directly
- [x] #5 Tests cover rename, technology, the draft tag and the project record with fixtures under test/fixtures
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
1. Core: src/edit.ts gains --title (frontmatter title of an element or a draft record, id and path unchanged) and --technology (groma.technology; empty removes it) through withTitle and withGromaField in markdown-emitter; the reserved id project routes to editProject, which merges --title, --description and --overview into the current profile and writes groma/project.md through saveProjectProfile. src/remove.ts takes { id } like every other writer. New src/authoring.ts exports the writes table (draft, add, edit, remove), each (repositoryRoot, input) => id, plus the input types; src/cli.ts and the web server import writes only from it.
2. CLI: groma edit <id> --title <text> --technology <text>, groma edit project --title --description --overview; ok and the id, or one sentence and exit 1.
3. Server: the write map gains POST /edit and loses PUT /project; the project popover posts { id: 'project', title, description, overview } to /edit; data.ts exposes edit instead of saveProject.
4. Web details pane: on the current revision of the live delivery, title, description, overview and technology are editable in place through one organism (organisms/editable.ts: click the text, Enter or blur saves, Escape cancels, the refusal sentence sits under the field) and a Draft select tags the element with one of the draft records; the code and file lists move to organisms/code-lists.ts so details.ts stays under 500 lines.
5. Tests: test/edit.test.ts covers the rename of an element and of a draft record, technology, the project record and their refusals on the plain-view fixture; test-bun/web-live.test.ts posts the project edit through /edit; test-bun/web-authoring.test.ts posts an element edit; test-bun/authoring-boundary.test.ts asserts that no file under src/viewers imports a write module or saveProjectProfile directly.
6. Docs and guides: README, product-model, shipped instructions, agent guide, web viewer doc, welcome table. Verify in the browser pane, run the checks, then the reviews.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Implemented: groma edit gains --title (frontmatter title of an element or a draft record; id and path unchanged) and --technology (groma.technology; empty clears) and routes the reserved id project to editProject, which merges title, description and overview into the current profile through saveProjectProfile; project.md joined the reserved document names. src/authoring.ts holds the writes table (draft, add, edit, remove; every writer takes repositoryRoot and one input) and the input types; src/cli.ts and src/viewers/web/server.ts import writes only from it; removeThing takes { id } like the others. The web server routes POST /draft, /add, /edit and /remove through one writeResponse and PUT /project is gone; the project popover posts { id: 'project', title, description, overview } through data.edit. The details pane edits title, description, overview and technology in place through organisms/editable.ts (click the text, Enter or leaving saves, Cmd or Ctrl with Enter saves the overview, Escape cancels, a refusal sits under the field) and tags the element through a Draft select fed by the draft ids the map payload now carries; the code and file lists moved to organisms/code-lists.ts so details.ts stays under 500 lines. Guides, README, product model, web doc and the welcome table describe the verb. Browser run on the plain-view demo: title edit posted /edit and renamed the actor in the pane, the hierarchy and the file; description saved on leaving the field; the Draft select tagged the actor (None then disabled); the project popover saved title and description through /edit and project.md carries them. Checks: Biome and tsc clean for the task's files (tsc still fails only on the TUI task's navigation.ts), Node 102/102; Bun 235/236 in the full run where the architecture-Markdown watch test hit its 20 s timeout under concurrency, then 8/8 for that file alone.

Cold simplicity review applied: requireText replaced a second title rule; each edit branch refuses with one sentence; the Draft select shares the editable box and error line; the pane's draft list travels with onEdit from paneWrites; the boundary test walks with readdir; the web edit test keeps only its success half; the comments say the table holds the writes the web shares with the CLI. Specification review: AC1 proven by test/edit.test.ts (rename of an element and a draft record with the id and file unchanged, technology set and cleared, the tag test from 241.1); AC2 by the project test in test/edit.test.ts, the web-live project edit through /edit, and the browser popover run; AC3 by the browser run of every field and the Draft select; AC4 by the writes table, one writeResponse per route and test-bun/authoring-boundary.test.ts; AC5 by the edit fixture under test/fixtures. Quality review: no reproducible defect in the supported flow; a blank title from the pane or the CLI is refused by requireText or by the project profile rule and the sentence lands under the field; every file stays under 500 lines (details.ts 449, render.ts 495).

Browser refusal check: submitting a blank title from the pane posted /edit, got 400, and the sentence '--title is required' appeared under the title field with the input still open for a retry; a single-line field opens with its text selected.

Full-context complexity review: no blocking finding. Applied: the boundary guard now also refuses viewer imports of markdown-emitter.ts and groma-filesystem.ts and the acceptGhost name. Reported to the owner rather than built: an overview emptied from the pane is refused with the CLI's 'is required' sentence because --overview '' still means 'not passed' (description and technology treat '' as clear); an open pane field is dropped silently when a world event repaints the pane (every web write publishes twice, and scan folds publish too); technology is accepted on people by edit and the pane while add refuses it; deriving the write routes from the writes table was considered and left explicit because slice 5 adds no new verb routes; render.ts stands at 497 lines, so the next web slice splits it first.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
groma edit <id> renames with --title and sets technology with --technology while ids and paths stay, and groma edit project edits the project record; the web reaches every shared write through the authoring table (POST /draft, /add, /edit, /remove, PUT /project gone), the project popover posts the edit input, and the details pane edits title, description, overview and technology in place and tags with a Draft select on the current revision of a live map. Verified with test/edit.test.ts, test-bun/web-live.test.ts, test-bun/web-authoring.test.ts, test-bun/authoring-boundary.test.ts, the Node suite (102/102) and the Bun suite (the web-live file 8/8 alone; the full run flakes on a watch test under concurrency), and browser runs of every field, the Draft select, the popover and a refused blank title.
<!-- SECTION:FINAL_SUMMARY:END -->
