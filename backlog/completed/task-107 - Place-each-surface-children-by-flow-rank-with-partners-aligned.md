---
id: TASK-107
title: Place each surface children by flow rank with partners aligned
status: Done
assignee:
  - '@claude'
created_date: '2026-08-22 19:58'
updated_date: '2026-08-22 21:13'
labels: []
dependencies: []
references:
  - sheet
ordinal: 118000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Every surface shelf-packs its children in hierarchy order, so related elements land far apart and routes travel across the map. Relationships should decide where children stand, and the authority is the approved drawing: the containers a person uses directly (cli, terminal viewer, web viewer) stand together in the first column, what they call comes next, and the core that everything feeds stands at the far east. Within every surface (the island row, each system island, each container slab, each zone) the children form columns from west to east by the flow among them: the children something outside the surface feeds stand first, and every other child stands east of whatever feeds it, by the longest chain; in a cycle the child the flow reaches first goes west, and an edge into an entry never moves it. Within a column children are ordered by the average position of their partners; a child with partners in earlier columns lines up with them, and a source with several targets in the next column stands at the centre of their span when the space is free. Unconnected children are shelf-packed as one block after the ranked columns. People and external islands shift along gy so their buildings face the centre of their partners. Containment, GAP, PAD, footprints and routing stay as they are; positions follow relationships, so adding a relationship may reorder a column.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Within a container, components form columns along gx by flow rank: for a chain a to b to c every later element stands east of the earlier one, and for a cycle a to b to a that the people reach at a first, a stays west of b
- [x] #2 Containers within a system island follow the same rule through their components (a container ranks where the flow first enters it); unconnected children keep the square-ish shelf as one block after the ranked columns, so a world without relationships lays out as before
- [x] #3 A child with one main partner in an earlier column aligns with it so the route between them is one straight run of two points, and a source whose several targets all stand in the next column is centred on their span within one cell when nothing else occupies that space
- [x] #4 People and external islands shift along gy so the centre of their buildings is within one cell of the centre of their partners; islands still form one row, ISLAND_GAP apart, inside the sheet margin
- [x] #5 Sibling footprints never overlap, keep GAP apart and PAD inside their parent, the sheet stays pure and deterministic, and bun run check passes with fixture tests for rank order, the cycle rule, container roll-up, alignment, fan-out centring and the island shift
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
1. src/sheet/rank.ts (pure): flowRanks(world) ranks every relationship endpoint by longest path after dropping back edges found by a DFS that starts from the people in hierarchy order, then from the other sources, then from whatever is left; ranks roll up to ancestors as the minimum over the subtree, so a container ranks where the flow first enters it.
2. src/sheet/pack.ts: columns(items, rankOf, partnersOf) next to shelf(): ranked items form columns (distinct ranks ascending, GAP apart, PAD inside), unranked items become one shelf block in a last column; within a column, order by the barycenter of partners in earlier columns; gy assignment west to east aligns a child on its main partner when free, else stacks it; one east to west pass centres a source on the span of its targets in the next column when free. Same Shelf result shape.
3. src/sheet/place.ts: packed() uses columns() with ranks and partner lists lifted to the surface children; placeRow orders system islands by rank and shifts people and external islands along gy to the centre of their partners; collect() unchanged.
4. test-bun/sheet-rank.test.ts: chain, cycle, roll-up, straight single-partner route, fan-out centring, island shift, no-relationship world unchanged; existing sheet-scene and sheet-route invariants stay green.
5. docs/viewers/web/index.md placement paragraph and groma/observed core/components/sheet.md prose; browser check of the live map.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Implemented src/sheet/rank.ts (flowRanks: DFS from people, then other sources, then the rest, dropping back edges; longest-path ranks; rolled up to ancestors as the minimum), columns() in src/sheet/pack.ts (ranked columns west to east, unranked shelf block last, barycenter order, align-or-stack west to east, source centring east to west, a stack mode for the people and external islands), and the wiring in src/sheet/place.ts (Flow context with parentOf as the node tree is built, partners lifted to each surface's children, system islands ordered by rank, people and external islands shifted along gy to the centre of their partners). The openclaw fixture has container relationships, so the old 'square-ish shelf' assertion on it was split: slab sizing stays on the fixture, the shelf shape is asserted on a hand-built world of six unconnected containers. New test-bun/sheet-rank.test.ts: chain plus cycle plus unconnected, container roll-up, single-partner alignment with a two-point route, fan-out centring, island shift. bun run check green (92 node + 126 bun tests). Live world ranks: people 0; cli 1; web-viewer, view-host, core 2; scanner, terminal-viewer 3; git 6; the Groma island grew from 82x34 to 100x50 because column widths follow their widest slab.

Cold simplicity review applied: flowRanks no longer rolls ranks up to ancestors (packed() already takes the minimum over its children, the one rule in one place); the shared mutable parentOf map and childHolding are gone, packed() claims each child's subtree into a local holder map and placeRow's walk records every node's island; the people and external islands use shelf(items, 1) directly instead of a stack mode in columns(); columns() keeps one wanted map across both passes; unreachable guards dropped; world() and uses() moved to test-bun/helpers.ts and shared by the sheet-rank, sheet-route, sheet-scene and web-url tests; one types import; the island shift is one sum. Kept, with reason: the rank walk starts from the people, then from the other sources, then from the rest, so a cycle entered from a non-person source still opens where the flow enters it (the agreed rule applied to any source, needed for repositories without people). Verification after the review: bun run check green (92 node + 126 bun tests); the live world dump is unchanged (cli rank 1; web-viewer, view-host, core 2; scanner, terminal-viewer 3; git 6; people island slid to gy 21 facing commands, screen and page; external island to gy 23 facing the Groma island and typescript-files).

Correction after Alex's review of the live map: the first rule (a global longest chain from the people) put the terminal viewer at rank 3, because the CLI also starts it (commands → terminal host → screen), and a second attempt (distance from the people) put core in the same column as the scanner; neither matched the approved drawing (cli, terminal, web in the first column, core at the far east). The rule is now per surface: flowRanks(order, entries, edges) ranks the children of one surface by the flow lifted to them (lifted() in place.ts: entries are the children something outside feeds, edges and partner counts come from relationships between things inside two children), entries pinned first and everything else east of what feeds it by the longest chain; the same call orders the system islands. Live world now: column 1 cli, web-viewer, terminal-viewer (fed by people); column 2 view-host; column 3 scanner (fed by cli, web-server and terminal host); column 4 core (fed by all of them); Git east on its island. bun run check green (92 node + 126 bun tests); test-bun/sheet-rank.test.ts unchanged and green under the new rule.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Relationships now decide where children stand, per surface: src/sheet/rank.ts ranks the children of one surface by the flow among them (what the outside feeds first, everything else east of what feeds it by the longest chain, cycles opened where the flow enters), src/sheet/pack.ts columns() lays them in rank columns west to east with partners lined up, sources centred on their targets and unconnected children in one shelf block, and src/sheet/place.ts lifts relationships to each surface's children, applies the rule recursively from the island row to slabs and zones, and slides the people and external islands to face their partners. On the live world the containers a person uses stand in the first column and core at the far east, as in the approved drawing. Verified with test-bun/sheet-rank.test.ts, the existing sheet invariants, the live placement dump and the browser; bun run check green.
<!-- SECTION:FINAL_SUMMARY:END -->
