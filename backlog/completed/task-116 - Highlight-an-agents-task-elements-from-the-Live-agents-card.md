---
id: TASK-116
title: Highlight the elements a selected task touches
status: Done
assignee:
  - '@claude'
created_date: '2026-08-23 09:47'
updated_date: '2026-08-23 11:15'
labels: []
dependencies: []
references:
  - iso-map
  - render
modified_files:
  - src/work-pins.ts
  - src/viewers/web/iso/map.ts
  - src/viewers/web/iso/style.ts
  - src/viewers/web/render.ts
  - test-bun/work-pins.test.ts
  - docs/viewers/web/index.md
ordinal: 127000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Selecting a task, from a pin, a chip or its URL, should show the task's footprint on the map: every element whose code holds one of its modified files and every element it references is outlined like a selection, so a person sees at a glance which parts of the system the work touches. Selecting anything else clears those outlines.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Selecting a task outlines on the map every element whose code holds one of its modified files and every element it references
- [x] #2 Selecting an element, a relationship or nothing clears the task's outlines
- [x] #3 The web viewer doc describes the highlighting
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
1. src/work-pins.ts: touchedElements(item, world) lists the elements whose code holds a modified file, newest first, then the referenced ones, each once; pinsOf stands a pin on the first of them (same stand as before).
2. src/viewers/web/iso/map.ts: mark(ids) toggles a touched class on the items; style.ts gives touched the selected look (emphasis, accent faces or ground, accent bold name).
3. src/viewers/web/render.ts: paintSelection marks the touched elements of a selected task and an empty set otherwise.
4. test-bun/work-pins.test.ts covers the order and dedupe; docs/viewers/web/index.md describes the outlines.
5. Browser: selecting a task adds touched to its elements, selecting an element or nothing removes it.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Browser evidence: selecting TASK-122 from its chip marked observed:web-server, observed:render, observed:iso-map and observed:backlog-plugin as touched with no element selected; clicking its Render reference selected that element, cleared the touched marks and wrote ?component=render; Escape cleared both. The touchedElements test covers the order (newest modified file's element first, then references) and the dedupe.

Review applied: mark() documented in its own place in the IsoMap interface, the touchedElements import with the other core imports. Post-review: selecting TASK-116 from its chip marked observed:render and observed:iso-map as touched. bun run check green.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Selecting a task outlines every element it touches on the map, the elements whose code holds one of its modified files and those it references, through touchedElements() in core (which also stands each pin on the first of them) and a touched class the map marks with the selection look; selecting an element, a relationship or nothing clears it. Verified by DOM script in Chrome and the touchedElements test.
<!-- SECTION:FINAL_SUMMARY:END -->
