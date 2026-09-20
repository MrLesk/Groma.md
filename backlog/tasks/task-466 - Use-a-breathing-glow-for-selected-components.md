---
id: TASK-466
title: Use a breathing glow for selected components
status: Done
assignee:
  - '@codex'
created_date: '2026-09-20 17:04'
updated_date: '2026-09-20 19:17'
labels: []
dependencies: []
references:
  - map
documentation:
  - docs/viewers/web/index.md
modified_files:
  - src/viewers/web/iso/paint-buildings.ts
  - src/viewers/web/iso/style.ts
  - src/viewers/web/iso/map.ts
  - docs/viewers/web/index.md
type: enhancement
ordinal: 542000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
A developer selecting a component sees its body repeatedly fade, which can suggest removal or inactivity. Alex chose the breathing outer glow from the visual comparison: the glow changes intensity while the selected component and its text remain solid.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Selecting a component shows a slow breathing green glow around its shape without fading its body or label.
- [x] #2 Changing or clearing component selection moves or removes the glow while preserving softer direct-neighbor highlights and dimmed unrelated components.
- [x] #3 A selected component remains solid when it is also a focused flow endpoint, and reduced motion uses steady selection emphasis.
- [x] #4 The wider breathing glow keeps the reported Safari map responsive, with frame rate comparable to the same view without component selection.
- [x] #5 The selected border stays green and gently shifts toward white with the glow, using only 20% white at the peak; its fill and text remain steady.
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
1. The map renderer draws a fixed 32-unit blurred silhouette on a small HTML layer. Its opacity breathes from 0.1 to 1 over 2.6 seconds. Each selected-component face follows the same timing, from highlight green to a mix containing 20% white and back. The fill, label and component opacity remain steady. 2. Each changed selection creates a fresh inner halo wrapper so its animation starts on the same frame as the selected border. Existing camera placement, neighbors, dimming and selection cleanup remain responsible for the rest. Reduced motion stops both animations. 3. Validate synchronized animation start times, unchanged fill/text, reduced motion, selection cleanup and native Safari FPS at component and full-map scales. Use browser evidence and existing tests; add no decorative assertions. Run bun run check. The behavior remains in map painting and adds no dependency or OKF/C4 semantics.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Selection still flows from map-highlights through markNeighbors into component-focus. buildingsSvg now places all geometry in one building-shape group beside the existing label. CSS animates only the group drop-shadow, from a quiet 2px halo to 6px over 2.6 seconds; the component and label retain opacity 1. The filter is local to the selected shape and introduces no viewport-sized filtered surface, state, dependency or architecture metadata. Existing direct-label and floor interactions remain valid. Browser verification on relationship-pairs showed Talks glowing, People/Sessions fully visible and Speakers dimmed to 0.3; selecting Speakers moved the glow and dimming correctly; Close removed every glow and restored opacity 1. In the flows fixture, selected Worker also had lit/focused/onpath classes but its group and label had no animation and opacity 1, while its shape ran map-component-glow. Reduced-motion emulation stopped the animation and retained the steady 2px glow, then emulation was reset. 32 focused selection/projection/port tests passed. Full bun run check passed: lint, TypeScript, Node tests, and 621 Bun tests passed with 36 skipped and zero failures; log /tmp/groma466-check.log. Implementer specification and quality reviews found all three acceptance criteria satisfied, clear renderer ownership and no supported-flow defect. No new tests were needed for this styling change; source files remain below 500 lines and diff whitespace checks pass.

Alex reports no visible glow at http://localhost:4747/?component=src-authoring&theme=blueprint. Reopened visual verification to inspect the reported page and browser before changing presentation. The server serves the current glow CSS and building-shape markup to a fresh in-app browser tab; the selected shape has map-component-glow and opacity 1. The actual user browser remains to be identified.

Reproduced the missing halo in native Safari on the reported Blueprint URL. A minimal side-by-side Safari comparison shows no CSS drop-shadow halo but a visible halo with an inline SVG blur/flood/composite/merge filter. Replace the rendering method for all browsers, with no browser detection or alternate path.

Alex clarified that the SVG test halo does pulse, but the intensity change is too subtle, and requested increased intensity. Keep the simpler working SVG filter animation and increase its radius and opacity range. The separate glow-layer experiment was limited to a temporary diagnostic page and is not part of the implementation.

Final Safari revision uses a single inline SVG alpha blur, green flood, composite and merge filter; the original SourceGraphic is merged last and remains opaque. The halo radius is 6 and its opacity breathes from 0.1 to 1 over 2.6 seconds, with a steady 0.55 under reduced motion. Native Safari verification on the exact src-authoring Blueprint page shows the visible green halo around the stacked component. The actual local viewer was restarted from the main checkout on port 4747 to load the revised CSS and renderer. Browser inspection confirmed selected body, shape and label opacity 1 while the flood animation changes intensity; reduced motion produces animation none and flood opacity 0.55. Selected Worker plus focused-flow overlap keeps body and label solid; closing details removes every shape filter. The final bun run check passed (621 Bun tests passed, 36 skipped, zero failures; lint, TypeScript and Node tests passed), log /tmp/groma466-strong-glow-check.log. Targeted specification and quality re-review confirmed the reported Safari visibility and weak-intensity findings are resolved, without browser detection, added state, extra glow geometry or changes to neighborhood semantics.

Alex requested a slightly wider halo, then reported 7 FPS and asked for a cheap solution. Reproduced 7 FPS on the selected src-authoring Blueprint page in Safari; closing details returned it to 60 FPS. The existing animation changes feFlood inside the foreground SVG every frame. Scope now includes removing this reproduced rendering regression while keeping the approved breathing glow.

Performance revision: componentGlow in iso/map.ts owns one tightly bounded HTML layer behind the existing foreground. It draws only the selected projected silhouette into a small SVG with a fixed 8-unit blur and 24-unit padding. CSS breathes the HTML layer opacity; neither filter parameters nor the main scene change per animation frame. Selection supplies the geometry, camera commits place it, and existing camera transforms carry it during motion. Clearing selection or hiding components empties and hides the layer. Removed the now-unneeded building-shape wrapper and shared animated filter; paint-buildings.ts is back to its original content. Native Safari on the reported Blueprint page improved from 7 FPS with the old glow (60 when selection cleared) to 60 FPS with the new halo, including a final zoomed-out sample at 342%; other observed interaction samples were 56 FPS. Browser checks confirmed changing selection moves the sole halo, uniform halo padding after zoom and 2D projection, correct direct neighbors and dimming, no halo after closing details or hiding components, and steady opacity 0.55 with reduced motion. A selected focused Worker flow endpoint and its label both keep opacity 1 and animation none while the halo animates. 32 focused tests passed; bun run check passed with 621 Bun passes, 36 skips and zero failures, plus lint, TypeScript and Node tests (log /tmp/groma466-cheap-glow-check.log). Final implementer specification and quality reviews found the requested wider halo and reproduced performance defect resolved. The entry point remains markNeighbors; geometry, camera alignment and lifecycle live together in the existing map renderer, with no new dependency, module or architecture state. No new styling assertions were needed; source files remain under 500 lines and git diff --check passes.

Alex requested a much larger blur after the title correction. Reopened this existing glow task for a fourfold increase in the fixed blur radius. Preserve the isolated cached glow surface and finite title layouts. No active task has overlapping files.

Wider-blur revision: raised the fixed Gaussian blur from 8 to 32 map units. The existing three-radius margin grows from 24 to 96 units, retaining a soft unclipped halo. Only the small cached layer opacity animates; no camera, title, selection or flow behavior changed. Native Safari on src-authoring shows the visibly wider halo with a solid component and readable text, and sampled 60 FPS with the halo active and 60 FPS after clearing selection. Full bun run check passed: lint/types and Node tests, 622 Bun passes, 36 skips, zero failures; log /tmp/groma466-wide-glow-check.log. No decorative tests added. Targeted specification and quality self-review found the requested wider blur satisfied, no lifecycle or ownership change, and no supported-flow defect; git diff --check passes. The viewer on port 4747 serves the update. A separate read-only probe for Alex’s HDR question found Safari 27.0 reports dynamic-range: high and video-dynamic-range: high false for this window, rejects rec2100-linear/rec2100-pq and color-hdr CSS colors, and exposes WebGPU. No HDR rendering was added. The temporary diagnostic tab and server were closed.

Alex approved trying a near-white green border inside the wide green glow. Only iso/style.ts needs a code change. Reviewed active TASK-468 and TASK-469 records: no recorded file overlap with this stylesheet. Preserve their pending work and the completed finite title layouts.

Alex revised the bright-white trial to a green -> white -> green pulse with the glow and much less than 80% whitening. Applying a maximum 20% white mix. The static 80%-white trial passed repository checks but is superseded by this request.

Implemented the restrained pulse with a direct stroke-color animation on selected faces, leaving body opacity, fill and text unchanged. The small halo gets a fresh HTML pulse wrapper on selection so both animations start together. Browser inspection confirmed exactly equal start times initially and after selecting Markdown storage, a maximum 20% white mix, body/text opacity 1 and zero text animations. Reduced motion stops both animations and keeps halo opacity 0.55. Clearing selection removes the halo wrapper and all border animations. Native Safari initially sampled 60 FPS with the stroke animation; checking the full-map view before finalization.

The full-map Safari view at 100% also sampled 60 FPS with the selected border and halo animating. The direct stroke-color approach therefore satisfies the reported live-map performance check without adding a second outline renderer. Kept the existing cached blur and one new inner HTML wrapper to synchronize selection changes. Consolidated the reduced-motion rule and updated the web guide to describe the final 20%-white border pulse accurately.

Final verification passed: bun run check completed with lint/types and Node tests, 623 Bun passes, 36 skips, zero failures (71.74 seconds; log /tmp/groma466-subtle-pulse-check.log). Final served CSS was checked again under reduced motion: all selected faces and the halo report animation none. Implementer specification and quality review confirmed the current requested result: green border -> 20% white mix -> green, synchronized with the wider halo, while fill/text and opacity remain steady. Browser timing, selection cleanup and reduced motion were verified directly; Safari sampled 60 FPS at rest at both component scale and full-map fit. No new tests or outline-rendering abstraction were needed. The final viewer is running on port 4747; diff whitespace checks pass and unrelated task work remains intact.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
The selected green border now gently lightens with the breathing halo, mixing in only 20% white at the peak and returning to green. A fresh halo wrapper keeps both animations synchronized after selection changes. Fill and text stay steady; reduced motion stops both. Browser timing and cleanup checks passed, Safari sampled 60 FPS at rest at close and full-map views, and bun run check passed (623 Bun tests, 36 skipped, zero failures).
<!-- SECTION:FINAL_SUMMARY:END -->
