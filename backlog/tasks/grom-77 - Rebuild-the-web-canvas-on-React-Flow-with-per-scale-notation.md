---
id: GROM-77
title: Rebuild the web canvas on React Flow with per-scale notation
status: To Do
assignee: []
created_date: '2026-07-20 17:45'
labels:
  - pivot
  - web
  - renderer
milestone: m-5
dependencies:
  - GROM-71
references:
  - brand/STYLE.md
  - ../expert-career-path/editor/src/graph.ts
priority: high
type: feature
ordinal: 74000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Replace the hand-rolled pan/zoom/layout canvas in groma web with React Flow plus deterministic dagre layout — the approach proven by the expert-career-path map (Vue Flow there; same xyflow family). The library must disappear into the brand: the luminous technical-sheet aesthetic, lowercase wordmark, restrained groma green, no dashboard chrome, no blueprint blue. Every scale gets a distinct visual notation explained by a legend in the title block, and unscaled components are visibly distinct — the map becomes self-explanatory to someone who has never seen the repo. Progressive disclosure becomes semantic: descend by scale (domains, then parts, then elements) with explicit load-more on top of bounded reads. The existing view-model and bounded API survive; the bespoke gesture and layout code retires.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 The canvas renders through React Flow with deterministic dagre layout, and the hand-rolled gesture and layout code is removed
- [ ] #2 Every scale has a distinct visual notation explained by an on-sheet legend, and unscaled components are visibly distinct
- [ ] #3 Disclosure descends by scale with explicit load-more affordances; no unbounded fetch and no whole-graph layout
- [ ] #4 Brand rules hold: sheet aesthetic, lowercase wordmark, restrained green accent, no dashboard chrome, no dark mode; keyboard navigation is preserved
- [ ] #5 Compiled-binary black-box smoke covers the new canvas and bun run check stays green
<!-- AC:END -->
