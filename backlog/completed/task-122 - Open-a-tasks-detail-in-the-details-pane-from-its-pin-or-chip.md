---
id: TASK-122
title: Open a task's detail in the details pane from its pin or chip
status: Done
assignee:
  - '@claude'
created_date: '2026-08-23 10:46'
updated_date: '2026-08-23 11:05'
labels: []
dependencies: []
references:
  - render
  - backlog-plugin
  - web-server
  - iso-map
modified_files:
  - src/types.ts
  - src/backlog-plugin.ts
  - src/work-pins.ts
  - src/viewers/web/payload.ts
  - src/viewers/web/server.ts
  - src/viewers/web/url.ts
  - src/viewers/web/organisms/details.ts
  - src/viewers/web/organisms/pins.ts
  - src/viewers/web/organisms/work-island.ts
  - src/viewers/web/render.ts
  - test-bun/work.test.ts
  - test-bun/work-pins.test.ts
  - test-bun/web-live.test.ts
  - test-bun/web-page.test.ts
  - test-bun/web-url.test.ts
  - docs/viewers/web/index.md
ordinal: 133000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Clicking a pin's head on the map or a chip in the Live work island selects that Backlog task instead of the element its pin stands on: the details pane shows the task's title, id, status and assignees, its description, its acceptance criteria as a checklist, the files it recorded as modified and its references, where a reference naming an architecture element is a link that selects the element. The page payload ships the active tasks themselves, description and criteria included, next to the pins derived from them, and the URL carries a selected task as task=<id> so the view opens again from its link.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Clicking a pin's head on the map or a chip in the island shows that task in the details pane: title, id, status, assignees, description, the acceptance criteria with their checked state, the modified files and the references
- [x] #2 A reference that names an architecture element is a link that selects the element
- [x] #3 The URL carries a selected task as task=<id> and opens it again; an unknown task id is ignored
- [x] #4 The payload's tasks carry their description and criteria; pins keep done and total counts derived from the criteria
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
1. src/types.ts: ActiveWorkItem gains description and criteria ({ text, checked }[]) in place of acceptance; src/backlog-plugin.ts maps them from task view --json; src/work-pins.ts derives done and total from the criteria.
2. src/viewers/web/payload.ts and server.ts: WebPayload.work with the items next to the pins.
3. src/viewers/web/url.ts: task=<id> read and written against the payload's work.
4. src/viewers/web/organisms/details.ts: paintTask with the meta line, description, criteria checklist, files and references as element links; page.ts mutes the checked criteria.
5. src/viewers/web/organisms/pins.ts and work-island.ts: clicks select the pin's task; render.ts keeps the work list, knows task ids, paints the task pane and reads and writes the URL.
6. Tests: work (plugin fields), work-pins (counts from criteria), web-live (work in the payload), web-url (task round trip), web-page (payload literal); docs/viewers/web/index.md.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Browser evidence: clicking a pin head and a chip for TASK-40 showed the pane with TASK-40 · In Progress · @scan, the title, the description, Acceptance criteria · 0 of 4 with four rows, Modified files and References, and wrote ?task=TASK-40; opening /?task=TASK-122 reopened that task with its element references as links (Render, Backlog plugin, Web server, Iso map); clicking Render selected the element and wrote ?component=render; /world.json carried the work items with string descriptions and criteria arrays, and the TASK-40 pin's 0 of 4 matched its criteria; an unknown task id is covered by the web-url test. Review applied: checked criteria reuse the ghost class instead of a new rule, the pane order wording fixed, the island const renamed so the task list keeps the payload's name work, docs rewrapped. bun run check green (92 node + 136 bun).
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Pins and chips select their task; the details pane paints a task with its id, status and assignees over the title, its description, the acceptance criteria as a checklist, the modified files and the references (element references as links); the payload ships the active tasks with description and criteria next to the pins, whose counts derive from the criteria; the URL carries task=<id>. Verified by DOM script in Chrome and by the work, work-pins, web-live, web-url and web-page tests.
<!-- SECTION:FINAL_SUMMARY:END -->
