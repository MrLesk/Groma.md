---
id: GROM-63
title: Explore the blueprint interactively in the web surface
status: To Do
assignee: []
created_date: '2026-07-19 22:27'
labels: []
dependencies:
  - GROM-62
references:
  - brand/STYLE.md
  - docs/interface-glossary.md
  - src/cli/blueprint-html.ts
priority: high
type: feature
ordinal: 60000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
With the embedded server in place, the web application must become the first interactive human blueprint experience: the bounded current hierarchy drawn as the branded technical sheet on a pannable, zoomable canvas, with progressive disclosure instead of loading the whole world, live component detail, and bounded search. Visual language follows brand/STYLE.md: single luminous white sheet, graphite structure, Groma green 1D9E75 restricted to surveyed points and selection, lowercase groma.md identity, no dark mode. All data access stays within the bounded read endpoints from GROM-62.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 The app draws root components as plates on one technical sheet with pan and zoom: pointer drag and wheel pan, pinch or ctrl/cmd+wheel zooms toward the cursor within fixed bounds, arrow keys pan, plus and minus zoom, 0 or a labeled Fit control fits the sheet; view state is never persisted
- [ ] #2 Containment is progressive: first-level children load with the initial view, deeper levels load on explicit expand through bounded children pages, and fold state is view-local; truncation from reached bounds is stated on the sheet rather than silently hidden
- [ ] #3 Selecting a component shows its drawing specification: display text, canonical name, type, stable identity, intent, label and summary when present, inputs, outputs, actions, and a bounded relationships page with explicit further paging
- [ ] #4 Search issues bounded queries, lists matches with type and identity, and selecting a match opens its specification; an unloaded match is still inspectable without loading the whole hierarchy
- [ ] #5 The interface uses the interface-glossary vocabulary, states the current generation, and remains keyboard reachable: search, expand, and selection work without a pointer
- [ ] #6 Styling implements the brand tokens as the single white theme with Tailwind; green appears only for surveyed points, selection, and the lockup suffix; no blueprint blue, dashboards, or dark mode
- [ ] #7 Client build stays deterministic and embedded; bun run check passes and browser verification against the self-blueprint workspace exercises canvas navigation, expand, selection detail, and search
<!-- AC:END -->
