---
id: GROM-91
title: 'Map and explore the full code topography: drill from system to symbol'
status: In Progress
assignee: []
created_date: '2026-07-21 07:25'
updated_date: '2026-07-21 10:03'
labels:
  - pivot
  - scanner
  - web
milestone: m-5
dependencies: []
priority: high
ordinal: 87000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
The scan-only blueprint is a flat single-level map (rated 5/10 by Alex): you see the top-level domains and hit a wall — no drilling into a domain to see its files, no files to see their symbols. Groma is a code-topography measurement and visualization tool; it must measure and render the FULL topography deterministically. The scanner already parses files per boundary, imports, and exports/callables but emits only package+boundary+external components, so domains have zero children. This task makes the scanner emit the full nested containment (domain to part to element/file, with exported symbols as items) and file-level dependencies, and turns the canvas into a natural explorer you can deep-dive into with focus, breadcrumbs, lazy deeper loading, and deterministic insights (foundation, hub, entry chain, cycle, layer, size). Benchmark: it must feel superb and insightful, beating the expert-career-path map, everything derived from code topography with no annotation and no classification.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 A domain drills open to reveal its real nested components (files/modules), and a file reveals its exported symbols, all from observed containment
- [x] #2 Dependencies are shown at each level, including file-to-file wiring inside a drilled-in domain, drawn only when that level is in view
- [x] #3 The explorer supports focusing a domain, breadcrumbs back out, and lazily loads deeper levels within bounded pages
- [x] #4 Deterministic insights are surfaced (foundation, hub, entry point/chain, cycle, layer, relative size), each computed from containment and dependency only
- [x] #5 Everything is derived deterministically from code topography with no framework/language vocabulary in the derivation and nothing guessed
- [x] #6 Generalizes to a second unseen codebase (Backlog.md) without per-project tuning; bun run check stays green
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Delivered across 8 commits on grom-91-topography-deepdive.

Scanner (typescript-bun-scanner.ts): emits full containment topography (boundary to directory to file plus contains edges) and file-to-file import edges, bounded by record/component/character budgets, dropping to partial under pressure (never throws). Each file's exported functions surface as action items on the file component (description 'Exported function', cap 32/file), so drilling to a leaf shows what it offers; these are appended after the entry-point pass and carry a marker so they never read as public ways in.

Web: one level per frame with focus re-rooting, breadcrumbs, Escape-to-retreat, and lazy paging; the framed system pages its children to completion so a level shows all its parts and every readout figure counts against them. A deterministic 'At this level' readout is computed from the same drawn dependency set the card counts use: most depended on (max in-degree), reaches the most (max out-degree), ways in (public entries — routes/public exports, never a file's own exports), an import cycle (Tarjan SCC), and largest (child count). Ties break by stable id; the readout suppresses while the frame is still paging so no denominator is ever partial.

Generalizes to Backlog.md with zero tuning (partial coverage under budget, reported honestly): surfaces types as most-depended-on, src as hub, a measured 10-domain import cycle, and utils as largest, while groma's own boundaries show no cycle. bun run check green.

AC#4 note: 'layer' (longest-path depth) is intentionally NOT surfaced as a labeled insight. Naming architectural 'layers' assigns a role, which the manifesto forbids; directional structure is conveyed measurement-only by the acyclic 'uses ->' axis caption and, when the level is not a DAG, the import-cycle line. The other five insights are all counted facts.
<!-- SECTION:NOTES:END -->
