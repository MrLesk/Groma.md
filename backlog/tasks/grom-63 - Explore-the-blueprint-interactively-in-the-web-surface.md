---
id: GROM-63
title: Explore the blueprint interactively in the web surface
status: Done
assignee:
  - '@claude'
created_date: '2026-07-19 22:27'
updated_date: '2026-07-19 23:03'
labels:
  - web
  - visualization
milestone: m-4
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
- [x] #1 The app draws root components as plates on one technical sheet with pan and zoom: pointer drag and wheel pan, pinch or ctrl/cmd+wheel zooms toward the cursor within fixed bounds, arrow keys pan, plus and minus zoom, 0 or a labeled Fit control fits the sheet; view state is never persisted
- [x] #2 Containment is progressive: first-level children load with the initial view, deeper levels load on explicit expand through bounded children pages, and fold state is view-local; truncation from reached bounds is stated on the sheet rather than silently hidden
- [x] #3 Selecting a component shows its drawing specification: display text, canonical name, type, stable identity, intent, label and summary when present, inputs, outputs, actions, and a bounded relationships page with explicit further paging
- [x] #4 Search issues bounded queries, lists matches with type and identity, and selecting a match opens its specification; an unloaded match is still inspectable without loading the whole hierarchy
- [x] #5 The interface uses the interface-glossary vocabulary, states the current generation, and remains keyboard reachable: search, expand, and selection work without a pointer
- [x] #6 Styling implements the brand tokens as the single white theme with Tailwind; green appears only for surveyed points, selection, and the lockup suffix; no blueprint blue, dashboards, or dark mode
- [x] #7 Client build stays deterministic and embedded; bun run check passes and browser verification against the self-blueprint workspace exercises canvas navigation, expand, selection detail, and search
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. Add a pure client view-model module (src/web/client/model.ts): bounded page merging for roots and children, display-text resolution, and cursor bookkeeping; unit-tested from src/web/tests/model.test.ts without DOM.
2. Rebuild the client app as the interactive map: a full-viewport canvas (drag, wheel pan, pinch or ctrl/cmd+wheel zoom toward cursor with 0.1x-3x bounds, arrows, plus/minus, 0 and a labeled Fit control reserving the detail panel) around one technical sheet that draws root components as plates with recursively nested component boxes in the brand drawing language.
3. Progressive disclosure: roots load as one bounded page with children fetched per plate; deeper levels fetch on explicit expand buttons; every hasMore page gets an explicit load-more affordance and bounded-view notes are stated on the sheet; fold state is view-local memory only.
4. Detail panel: selecting a component fetches the exact read and shows display text, canonical name, type, stable identity, revision, intent, label, summary, inputs, outputs, actions, scan-evidence presence, and a bounded relationships list with explicit further paging.
5. Search: an Enter-submitted bounded search in the header chrome lists matches with type and identity; choosing one opens its detail without loading the whole hierarchy; Escape dismisses.
6. Copy uses the interface-glossary surface words (blueprint, component, relationship, intent, evidence, detail); the header states the current generation; fold, expand, select, search, and load-more are real buttons so the surface stays keyboard reachable; canvas keys ignore typing contexts.
7. Verify with bun run check and a browser walkthrough of the compiled binary against the self-blueprint: canvas navigation, expand, selection detail, relationships paging, and search.
Supported boundary: view-only exploration; editing, live refresh, relationship drawing on the sheet, and deep-link routing stay out of scope; highlight-on-search applies only to already-loaded nodes.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Client structure: model.ts (pure bounded-page view-model, unit-tested), canvas.tsx (imperative pan/zoom identical in feel to the local artifact: drag with click suppression, wheel pan, pinch and ctrl/cmd+wheel zoom toward cursor clamped 0.1x-3x, arrows, plus/minus, 0 and Fit reserving the panel; view state in memory only; a ResizeObserver keeps re-fitting until the first deliberate interaction so late-arriving layout or stylesheet application cannot strand the initial view), app.tsx (sheet with title block, plates, notation footer, progressive children loading, load-more affordances, bounded-view note, search dropdown), spec.tsx (detail panel with bounded relationships paging and resolved display names). The map surface is user-select none so dragging pans instead of selecting text; interface copy uses the glossary surface words.
Validation: bun run check green (427 tests incl. 4 view-model tests). Browser verification in dev and against the compiled binary on the self-blueprint at generation 141: deterministic fit beside the panel, drag pan and ctrl-wheel zoom with clamps (scripted DOM events), selection of Visual Blueprint Renderer and Scanner Runtime showing full curated intent, inputs, outputs, actions, evidence state, and relationships with resolved names, bounded search for scanner with type and identity rows and select-to-detail, expand chevrons fetching bounded children pages. Found and fixed during verification: initial fit raced a zero-sized viewport (now guarded plus observer-driven refit) and text selection during drag (now suppressed on the map only).
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
groma web is now the first interactive human blueprint experience: the bounded hierarchy drawn as the branded technical sheet on a pannable, zoomable canvas with progressive disclosure (bounded root, children, and search pages with explicit load-more), live component detail through the exact read including intent, evidence presence, and paged relationships, and bounded search — all in the glossary vocabulary on the single white brand theme, keyboard reachable, embedded entirely in the compiled binary. Verified with the full bun run check gate (427 tests) and interactive plus scripted browser verification of the compiled binary against Groma's own blueprint.
<!-- SECTION:FINAL_SUMMARY:END -->
