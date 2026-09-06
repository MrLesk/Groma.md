---
id: TASK-105
title: Select a relationship from its route and carry it in the URL
status: Done
assignee:
  - '@claude'
created_date: '2026-08-22 18:59'
updated_date: '2026-08-22 19:21'
labels: []
dependencies: []
references:
  - iso-map
  - render
  - web-viewer
ordinal: 116000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
A route on the isometric map can only be hovered for its tooltip; the connection it draws cannot be selected, so the two elements it joins are not called out together and a link cannot open the map on that connection. Clicking a route selects its relationship: the route and both of its ends draw in the accent, the details pane shows the relationship with its ends as links, and the query string carries relationship=<source id>/<target id> next to the existing element, flow, by, tab and theme parameters, so the connection opens again from its link.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Clicking a route on the map selects its relationship: that route and both of its end elements draw in the accent, no other element is marked selected, and the details pane shows the relationship description, its origin and both ends as links that select those elements
- [x] #2 Selecting a relationship writes relationship=<source id>/<target id> (authored ids) to the query string with history.replaceState, deselecting by a click on the sheet or Escape removes it, and loading a URL with relationship=<source>/<target> opens with that route and both ends highlighted and the relationship in the details pane
- [x] #3 A world update keeps a selected relationship that still exists, and a stale or unknown relationship pair in the URL is ignored
- [x] #4 Query string parsing and writing stay pure functions covered by hand-built world tests; bun run check passes
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
1. src/viewers/web/url.ts: selectedId may name an element or a relationship; relationship=<source>/<target> is read and written next to element=<id>, sharing one source/target pair helper with flow.
2. src/viewers/web/iso/paint-routes.ts: every route group carries data-id=<relationship id>, so hitId resolves a click on the wide hit line to the relationship.
3. src/viewers/web/iso/map.ts select(id): a relationship id marks its route and both end items selected; an element id keeps the current marking (item, context surface, touching routes). style.ts: .route.selected shares the accent rule of .route.endpoint.
4. src/viewers/web/render.ts: select accepts element and relationship ids; the details pane shows a selected relationship through paintRelationship in organisms/details.ts (description, origin, both ends as links); applyWorld keeps a selection that still exists in the new world.
5. test-bun/web-url.test.ts: relationship round trip and a stale pair ignored; docs/viewers/web/index.md; browser verification on port 4747.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Implemented: route groups carry data-id=<relationship id> (paint-routes.ts), so the existing hit path delivers a relationship id to select(); map.select marks a selected route and both of its ends (no context, no endpoint routes) or an element as before; style.ts gives .route.selected the accent rule of .route.endpoint and keeps it undimmed under a lit flow; url.ts reads and writes relationship=<source>/<target> next to the kind-keyed element (person=, system=, container=, component=) through one ends() helper shared with flow; render.ts accepts element or relationship ids (known) and paints a selected relationship with paintRelationship (description as title, 'Relationship · origin', both ends as links). Cold simplicity review applied: precedence test dropped, writer helper renamed ends, plain if instead of else-if, meta without technology, byId.get(id)! for resolved ends, ?? '' idiom in map.select. Verified in the browser (1280x800): a pointer click on the hit line of relationship:3 at its middle segment (elementFromPoint returned that route's .hit) selected the route and observed:architecture-model and observed:world-layout only, wrote ?relationship=architecture-model/world-layout, and the pane showed 'Supplies the complete annotated architecture' with ▪ Architecture model and → ▪ World layout; a click on the empty sheet and Escape each cleared selection, pane and query; with a flow lit the selected route kept opacity 1 and the query carried relationship and flow; the pane's end link selected the element (?component=architecture-model&flow=commands/instructions, context core, two endpoint routes); loading /?relationship=commands/scan and /?relationship=groma/git opened with the route and its ends selected and the pane filled; ?person=groma&tab=how ignored the mismatched kind and fell back to ?system=groma&tab=how; a live world update (touching an architecture file, SSE repaint confirmed by a replaced route node) kept relationship:20 selected with the query unchanged; history.length stayed 8 throughout. bun run check green (92 node + 120 bun tests).
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
A route on the map is now selectable: clicking its line selects the relationship, which draws the route and both of its ends in the accent, shows the relationship in the details pane with its ends as links, and writes relationship=<source>/<target> to the query string, restored on load; the selected element is keyed by its kind (person=, system=, container=, component=<id>). Verified with pointer-event clicks through real hit testing, URL loads, deselection, a lit flow and a live world update in the browser, plus hand-built world tests for the query string; bun run check green.
<!-- SECTION:FINAL_SUMMARY:END -->
