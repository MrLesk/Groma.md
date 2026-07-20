---
id: GROM-77
title: Rebuild the web canvas on React Flow with per-scale notation
status: Done
assignee:
  - '@codex'
created_date: '2026-07-20 17:45'
updated_date: '2026-07-20 20:31'
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
- [x] #1 The canvas renders through React Flow with deterministic dagre layout, and the hand-rolled gesture and layout code is removed
- [x] #2 Every scale has a distinct visual notation explained by an on-sheet legend, and unscaled components are visibly distinct
- [x] #3 Disclosure descends by scale with explicit load-more affordances; no unbounded fetch and no whole-graph layout
- [x] #4 Brand rules hold: sheet aesthetic, lowercase wordmark, restrained green accent, no dashboard chrome, no dark mode; keyboard navigation is preserved
- [x] #5 Compiled-binary black-box smoke covers the new canvas and bun run check stays green
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. Add pinned React Flow and dagre dependencies and a pure deterministic layout projection over only the currently loaded bounded model.
2. Replace the bespoke canvas and recursive boxes with branded React Flow component nodes, containment leaders, scale-specific notation, title-block legend, and accessible built-in controls.
3. Make disclosure explicit: load no child page until its component is opened, label expansion by the next scale, and retain root/child continuation affordances.
4. Add pure layout/disclosure tests and strengthen the compiled-binary web smoke to prove the bundled React Flow client is served.
5. Exercise the compiled UI in a browser, regenerate the self-workspace, and run bun run check.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Implemented the React Flow renderer with deterministic dagre-per-root-subtree layout and bounded shelf packing. Removed bespoke gesture/layout behavior and eager child loading. Added distinct system/domain/part/element/unscaled notation, explicit scale-labelled disclosure, root/child continuations, accessible React Flow controls, pure layout tests, and compiled-client smoke assertions. Browser validation confirmed readable 17-root packing, bounded child disclosure, selection, legend, and scale proposal detail.

Final validation: the refreshed 19-root self-workspace rendered as a readable packed sheet; keyboard Enter activation selected application and opened its inspector without the React Flow wrapper swallowing the event. bun run check passed with 447 tests, standalone asset inspection, compiled web smoke, and the complete compiled workflow/crash suite.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Replaced the bespoke web canvas with a branded React Flow renderer and deterministic dagre subtree layout. Added five explained scale notations, roots-only initial loading, scale-labelled bounded disclosure, keyboard-operable nodes and controls, compiled asset smoke coverage, documentation, and a refreshed self-workspace. Verified with pure layout tests, browser mouse/keyboard interactions, and bun run check (447 tests).
<!-- SECTION:FINAL_SUMMARY:END -->
