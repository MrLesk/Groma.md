---
id: TASK-44
title: Show relationship text only for the selection
status: Done
assignee:
  - '@grok'
created_date: '2026-08-16 15:32'
updated_date: '2026-08-16 15:38'
labels: []
dependencies:
  - TASK-43
references:
  - docs/viewers/index.md
  - docs/viewers/web/index.md
  - docs/viewers/tui/index.md
  - src/viewers/web/render.ts
  - src/viewers/tui/molecules/route.ts
priority: high
type: feature
ordinal: 48000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
When a human architect uses `groma web` or `groma view`, routes stay on the map and a relationship description is drawn on its route only while that relationship's source or target is selected. Other routes stay unlabeled. The world layout does not change.

On the web, click a box to select it; click empty space or Esc clears. The selected box stays highlighted. Incident route text appears. A screen-space details panel shows the selection. The TUI already has selection and details; it stops printing a label on every route.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 On `groma web` the first view shows routes without relationship descriptions
- [x] #2 Clicking a box selects it and draws descriptions only on routes that start or end at that box; clicking empty space or Esc clears the selection and the route text
- [x] #3 A screen-space details panel shows the selected element; the world layout does not change
- [x] #4 On `groma view` a relationship label is drawn only when the current selection is that route's source or target
- [x] #5 Viewer docs and the map component documents state the shared rule
- [x] #6 TUI tests cover the label-gating rule; the live web page is checked in the browser
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
1. Write the shared viewer rule in docs/viewers/index.md, then the TUI and web pages, and the map / web-map component documents.
2. Put the endpoint check in one small shared function both viewers call.
3. TUI: drawRouteLabel only when the selection is an endpoint. Add a concurrent test for the gate.
4. Web: click selects a box, drag still pans, empty click or Esc clears. Highlight the selection, show only incident route text, and fill a screen-space details panel. Do not relayout or refit.
5. Browser-check groma web; run the TUI and scene tests and bun run check.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Shared `showsRelationshipText` gates both viewers. TUI `drawRouteLabel` returns unless the selection is an endpoint. Web: first view has routes only; click selects (drag still pans); Esc or empty click clears; incident labels and a details overlay; no refit. Browser: first frame has no route sentences; click Web viewer shows details and only "Supplies the annotated world"; Esc hides both. bun run check green (62 node, 32 bun including relationship-text). Cold simplicity review suggested dropping hover and the details relationship list; hover was already on the city; the list matches TUI details and is the same incident set.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Routes stay on the map. Relationship text is drawn only while the selected element is that route's source or target. groma web gained click-to-select, a details overlay, and incident labels; groma view stopped labeling every route. Verified in the browser on this repository and with bun run check.
<!-- SECTION:FINAL_SUMMARY:END -->
