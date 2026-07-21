---
id: GROM-91
title: 'Map and explore the full code topography: drill from system to symbol'
status: In Progress
assignee: []
created_date: '2026-07-21 07:25'
updated_date: '2026-07-21 07:25'
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
- [ ] #1 A domain drills open to reveal its real nested components (files/modules), and a file reveals its exported symbols, all from observed containment
- [ ] #2 Dependencies are shown at each level, including file-to-file wiring inside a drilled-in domain, drawn only when that level is in view
- [ ] #3 The explorer supports focusing a domain, breadcrumbs back out, and lazily loads deeper levels within bounded pages
- [ ] #4 Deterministic insights are surfaced (foundation, hub, entry point/chain, cycle, layer, relative size), each computed from containment and dependency only
- [ ] #5 Everything is derived deterministically from code topography with no framework/language vocabulary in the derivation and nothing guessed
- [ ] #6 Generalizes to a second unseen codebase (Backlog.md) without per-project tuning; bun run check stays green
<!-- AC:END -->
