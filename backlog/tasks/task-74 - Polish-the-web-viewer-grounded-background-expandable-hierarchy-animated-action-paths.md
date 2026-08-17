---
id: TASK-74
title: >-
  Polish the web viewer: grounded background, expandable hierarchy, animated
  action paths
status: Done
assignee:
  - '@claude'
created_date: '2026-08-16 21:32'
updated_date: '2026-08-17 06:21'
labels: []
dependencies: []
ordinal: 79000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Second polish pass on the web viewer after TASK-73. The fine-line radial-fade grid reads dirty; replace it with a calm drawing surface where soft neutral shadows ground the city. The hierarchy pane cannot be expanded or collapsed by hand; wire the existing TreeState overrides to the twist control. The active person-command path only dims the rest of the city; animate it so the path is unmistakable: a green overlay and traveling surveyed points along each lit route, matching the brand rule "traced journey: stronger route with surveyed green points". Rework spacing throughout the chrome for a more generous, consistent rhythm.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 The map surface is a calm drawing sheet: the city is grounded by a soft neutral shadow and any grid texture is quiet at every camera angle, with no dirty vignette or moire banding
- [x] #2 Hierarchy rows with children expand and collapse from their twist control without changing the selection; the path to the current selection stays visible; collapsed rows keep their child count; the toggle behavior is covered by a test
- [x] #3 While a person command is active its lit routes carry a green overlay and continuously moving green points from source to target; picking another command moves the animation; x stops and removes it
- [x] #4 Header, panes, legend, footer, and details sections share a generous, consistent spacing rhythm
- [x] #5 All other behavior is unchanged and bun test passes
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
1. Add a pure toggleExpansion(tree, row) to src/viewers/tui/tree.ts and cover it in test-bun/tree.test.ts; wire it from the web hierarchy twist (separate click target) through render.ts state.
2. Replace the radial-fade line grid in render.ts with a calm ground: soft blurred shadows under root elements (new molecules/shadow.ts, added by city.ts for layer-0 items) and, only if it earns its place visually, a very quiet wide-spaced dot texture.
3. Expose route polylines from molecules/route.ts and add a flow animation in render.ts: per lit route a green overlay line plus traveling accent points advanced by requestAnimationFrame while a person command is active, fully disposed when it clears or the world rebuilds.
4. Spacing pass in page.ts: taller header and footer, roomier tree rows, legend, details sections, zoom buttons; twist hover affordance.
5. Verify visually across Iso, Plan, orbit angles, zoom levels, and two window sizes; bunx tsc; bun test.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Verified in Chrome against the live server. Ground: line grid deleted; molecules/shadow.ts paints a blurred canvas penumbra under every layer-0 element, checked in Iso, Plan, ground-level orbit, and 305% zoom with no banding or vignette. Hierarchy: twist click toggled Coding-agent-selected tree 4 to 12 rows and back with selection unchanged (DOM script), covered by the new toggleExpansion test. Flow: lit routes carry an accent bar overlay plus travelling dots; two frames 1.1s apart show moved dots; picking Runs-a-scan moved the animation to that route; x removed it and restored the footer hint. Spacing pass across header (52px), tree rows, legend, details (24px padding, 26px section rhythm), footer (40px), zoom buttons (28px). Cold simplicity review applied: flowKey reset folded into clearFlow, one shared flowMaterial, toggleExpansion takes a plain TreeRow. bunx tsc clean; bun test 143 pass.

Post-completion adjustment on user request: the + and - zoom buttons moved from the map corner into the footer beside Fit/Plan/Iso (page.ts markup and styles, docs updated); render.ts wiring unchanged.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Polished the web viewer: replaced the fine-line grid with soft blurred ground shadows under root elements (new molecules/shadow.ts), made the hierarchy expandable by hand via a pure toggleExpansion on the shared TreeState wired to the twist control (with test), animated active person-command paths as a green bar overlay with surveyed points travelling source to target under requestAnimationFrame (built, moved, and torn down by a keyed syncFlow), and reworked chrome spacing throughout page.ts. Docs updated. Verified with browser screenshots across views and zooms, DOM-script checks for toggling and command switching, frame comparison for motion, bunx tsc, and bun test (143 pass).
<!-- SECTION:FINAL_SUMMARY:END -->
