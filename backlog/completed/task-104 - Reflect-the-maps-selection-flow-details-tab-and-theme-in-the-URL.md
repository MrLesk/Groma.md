---
id: TASK-104
title: 'Reflect the map''s selection, flow, details tab and theme in the URL'
status: Done
assignee:
  - '@claude'
created_date: '2026-08-22 13:08'
updated_date: '2026-08-22 19:03'
labels: []
dependencies: []
references:
  - render
  - web-viewer
ordinal: 115000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
A selected element, a lit person command, the details tab and the dark theme live only in the page memory, so a view cannot be opened in a new tab or shared. Mirror that state in the query string and restore it on load: the selected element under its kind (person=<id>, system=<id>, container=<id> or component=<id>), flow=<source id>/<target id> with an optional by=<person id> for the lit person command and its scoping, tab=how for the How it is built tab, theme=dark for the dark theme. Defaults stay out of the URL, the URL updates without reloads or history entries, and an unknown value is ignored.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Selecting an element rewrites the query string to <kind>=<element id> (person, system, container or component; the id, not the representation id), deselecting removes it, and loading a URL with <kind>=<id> opens with that element selected in the map, the tree and the details pane
- [x] #2 Lighting a person command writes flow=<source id>/<target id> (plus by=<person id> when picked from a person own details), clearing it removes both, and loading such a URL lights the same walk
- [x] #3 The How it is built tab writes tab=how and the dark theme writes theme=dark; their defaults write nothing; loading restores both
- [x] #4 Unknown or stale values are ignored (a kind naming an element of another kind included) and the page still loads; the URL is updated with history.replaceState so the back button is not polluted
- [x] #5 The query string is parsed and produced by pure functions covered by fixture or hand-built world tests; bun run check passes
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
1. src/viewers/web/url.ts (pure): readView(search, world) parses node, flow, by, tab and theme into { selectedId, action, tab, dark } using element ids and source/target ids resolved against the world, ignoring unknown values; writeView(state, world) produces the query string with defaults omitted.
2. render.ts: boot state comes from readView(location.search) with the first internal system as the fallback selection only when the URL names nothing; every state change (select, deselect, pickAction, clearAction, tab, theme) calls history.replaceState with writeView; the theme toggle reads its initial value from the URL.
3. test-bun/web-url.test.ts: hand-built world; round trips for node, flow with and without by, tab and theme; stale ids ignored; defaults produce an empty query.
4. docs/viewers/web/index.md: a paragraph on the shareable URL.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Implemented src/viewers/web/url.ts (readView/writeView, pure) and wired it into render.ts: boot state comes from the query string (<kind>=<id>, flow=<source>/<target>, by, tab=how, theme=dark) with the first internal system as the fallback selection, and every state change (select, deselect, pick, clear, tab, theme) rewrites the URL with history.replaceState. Verified in the browser: opening /?component=iso-map&flow=commands/scan&by=human-architect&tab=how&theme=dark selected Iso map in map, tree and details, lit the 9 routes of the scoped walk, opened the How it's built tab and the dark theme; toggling the theme, switching the tab, clearing the flow with x, selecting Coding agent from the tree and pressing Escape rewrote the query string step by step down to empty, with history.length unchanged at 2. bun run check green. Correction before commit: the selection parameter was first called node, which is not a Groma concept; it is now the element's kind (person, system, container or component), so a link reads as what it opens, and a kind naming an element of another kind is ignored.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
The map's view now lives in the URL: the selected element under its kind (person=<id>, system=<id>, container=<id> or component=<id>), flow=<source id>/<target id> plus by=<person id> for a lit person command and its scoping, tab=how for the How it's built tab and theme=dark for the dark theme, written with history.replaceState on every change and restored on load, defaults omitted and unknown values ignored. Parsing and serialising are pure functions in src/viewers/web/url.ts with hand-built world tests; verified by loading a full link in the browser and watching the query string follow each interaction; bun run check green.
<!-- SECTION:FINAL_SUMMARY:END -->
