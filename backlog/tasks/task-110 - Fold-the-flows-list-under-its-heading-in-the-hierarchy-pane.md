---
id: TASK-110
title: Fold the flows list under its heading in the hierarchy pane
status: Done
assignee:
  - '@claude'
created_date: '2026-08-22 21:40'
updated_date: '2026-08-22 21:48'
labels: []
dependencies: []
references:
  - render
ordinal: 121000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
The flows list sits open at the top of the hierarchy pane and pushes the tree down. It should fold under its Flows heading: closed when the page opens, opened and closed by clicking the heading.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 The hierarchy pane opens with the Flows heading and the list folded away
- [x] #2 Clicking the heading opens the list; clicking again folds it; the state survives selection changes and world updates
- [x] #3 Picking a flow from the open list lights it as before
- [x] #4 The web viewer doc describes the folded list
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
1. src/viewers/web/organisms/flows.ts: the Flows heading becomes a button with a fold glyph; the rows sit in a div hidden while folded; a module-level flag keeps the fold state across repaints and world updates.
2. src/viewers/web/page.ts: style the heading button like the section label.
3. Update the hierarchy paragraph in docs/viewers/web/index.md.
4. Verify in the browser: folded on load, opens on click, stays open after selecting, picking a flow lights it.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Flows heading is a button with a fold glyph; the rows sit in a div hidden while folded; a module-level flag keeps the state. bun run check green. Browser check: on load the heading reads '▸ Flows', aria-expanded=false, list hidden with 12 rows; after a click '▾ Flows', 12 rows visible; selecting a tree row kept it open; picking the first row lit 3 routes and set flow=commands/instructions in the URL.

Simplicity review: the heading click now flips the fold flag (renamed unfolded) and repaints the list instead of patching attributes; hover rule dropped. Re-verified after a server restart: folded on load ('▸ Flows', aria-expanded=false, list hidden), opens on click with 12 rows, stays open after selecting a tree row and after picking a flow (3 routes lit, flow=commands/instructions in the URL), folds again on the next click. bun run check green.

World update check: with the list open, touching groma/observed/README.md made the server publish generation 2 over /events; the list stayed open with its 12 rows after the repaint.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
The flows list in the hierarchy pane folds under a Flows heading button: closed on load, toggled by click, state kept across repaints by a module flag in organisms/flows.ts. Verified in the browser through DOM scripting; doc updated.
<!-- SECTION:FINAL_SUMMARY:END -->
