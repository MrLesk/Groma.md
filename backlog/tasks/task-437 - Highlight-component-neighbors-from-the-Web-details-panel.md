---
id: TASK-437
title: Highlight connected components on selection
status: Done
assignee:
  - '@codex'
created_date: '2026-09-19 09:47'
updated_date: '2026-09-20 12:05'
labels: []
dependencies: []
references:
  - render
  - organisms-details
  - web-page
  - map-highlights
  - map
modified_files:
  - src/viewers/web/map-highlights.ts
  - src/viewers/web/render.ts
  - src/viewers/web/organisms/details.ts
  - test-bun/web-map-highlights.test.ts
  - docs/viewers/web/index.md
  - src/viewers/web/page.ts
  - src/viewers/web/iso/map.ts
  - src/viewers/web/iso/style.ts
  - test-bun/pull-request-review.test.ts
ordinal: 510000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
A developer inspecting a component needs to see its directly connected neighbors on the map without leaving that component in the detail panel.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Selecting a component automatically highlights its directly connected components in a softer green; there is no Blast radius button or toggle state.
- [x] #2 The currently selected component uses the existing flow focus pulse, respecting reduced motion; changing or clearing selection updates the emphasis.
- [x] #3 Highlighting preserves detail ownership, camera, and existing task, flow, and PR highlights; focused tests and browser verification pass.
- [x] #4 While a component is selected, all other components except its direct neighbors are dimmed; clearing component selection restores their normal appearance.
- [x] #5 The selected component shape pulses while its label remains steady, including when it is also a focused flow endpoint.
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
1. Keep the existing component-focus and neighbor classification, and dim all other component bodies using scoped map CSS. 2. Apply the selected component pulse to its geometry children, leaving the label outside the animation, including focused-flow overlap. 3. Update documentation, verify selection, clearing, and motion in a fixture browser, and run bun run check. Coverage decision: existing map-highlights tests already prove one-hop classification and clearing. These additions only change CSS presentation; add no decorative tests. Browser inspection will detect unrelated components staying bright or labels inheriting pulse opacity.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Implemented browser-only map-highlights state using existing map route selection styling. Details owns the component-only toggle. Incoming and outgoing edges are one hop; no architecture, OKF, C4 or source-language rules changed. Existing flow filtering is suspended while the toggle is active and restored when it ends. Extracted map emphasis from render.ts to keep it under 500 lines. Focused tests: 8 passed. Browser verification on an isolated flows fixture confirmed both directed routes and their endpoints highlight, toggling off restores ordinary selection, changing component clears the toggle, and all three camera transforms and the detail title remain unchanged on toggle. Improved button spacing and active styling after visual inspection. Initial full check hit sandbox server/watcher restrictions; final unrestricted check is running alone after stopping overlapping runs.

Implementer specification and quality reviews: button → map-highlights toggle → repaint → direct relationship IDs → existing map endpoint styling. Inspector selection and camera are never changed by this path. Existing task and flow emphasis still use their original calculations; flow-only filtering is suspended while blast radius is active. No new stored concept or language-specific assumption. All changed source/test files stay below 500 lines, changed functions pass the complexity limit, and diff whitespace checks pass. No supported-flow defect found. Final unrestricted full suite currently reports Python scanner 20-second timeouts, outside the changed viewer path.

Final validation: bun run check completed with lint/typecheck and Node tests passing; Bun suite: 593 pass, 35 skip, 8 fail (all Python scanner 20-second timeouts). The unchanged Python file passes alone with the same 20-second limit: 10 pass in 12.67s, individual cases 7.68–12.58s versus about 20s in the full suite. No viewer modules are imported by those scanner cases; the exact cause of the suite-only slowdown remains unresolved. No assertions, timeouts, retry settings, or unrelated scanner code were changed. All new map-highlight tests passed in the full suite. AC 3 and overall completion remain unchecked because it requires a passing full repository check; implementation and browser verification are complete.

Alex revised the requested behavior: remove the explicit Blast radius control, automatically give connected components softer green emphasis, and pulse the selected component using the flow animation. Replace the first implementation directly. Preserve later PR highlighting and concurrent task/flow support.

Revised implementation: the current primary component selection supplies a one-hop set of component peers in map-highlights.ts. The map owns distinct neighbor and component-focus classes; CSS gives neighbors a quieter green outline and reuses map-flow-focus for the selected component. No toggle state, detail control, or new architecture metadata remains. Flow, task, and PR calculations are preserved. Twelve focused tests passed, including direction, one-hop boundary, clearing, flow coexistence, and PR ownership. Browser fixture verified no button, softer neighbor stroke, exactly the selected component using map-flow-focus, emphasis switching between components, and no remaining emphasis after Close. Reduced-motion emulation verified animation: none and was reset afterwards. Implementer specification/quality review traced selection → neighborhood → map classes → shared animation; no hidden state, camera change, or supported-flow defect found. Changed source files remain under 500 lines; focused lint and whitespace checks pass.

Final revised bun run check passed with required OS access: lint, scrollbar ownership, TypeScript, Node tests, and the full Bun suite. Log: /tmp/groma-task-437-auto-check.log. The earlier Python suite timeout limitation does not apply to this passing revision.

Alex requested automatic dimming of all components outside the selected component and its direct neighbors, and a steady text label during the selected shape pulse. This replaces prior full-brightness treatment of unrelated task/flow components while a component owns selection; no stored architecture or neighbor semantics change.

Dimming revision changes only map CSS and its documentation. Existing component-focus/neighbor classes drive an opacity 0.3 rule for other component groups; actors and external systems are unaffected. The selected component group never animates, and its geometry children reuse map-flow-focus while its sibling label stays steady. Browser verification on relationship-pairs: Talks selection keeps Talks, People, Sessions at opacity 1 and Speakers at 0.3; Speakers selection keeps only Speakers and People clear; Close restores all four to opacity 1. Selected group and label have animation none while geometry uses map-flow-focus. A selected Worker that is also a focused flow endpoint retains a steady group/label and animated geometry. Reduced-motion emulation stops geometry animation and was reset. No new tests: existing classification/clearing coverage plus these direct presentation checks cover this styling request. Implementer specification and quality review found no behavior outside the requested dimming and label change; camera/selection data paths are unchanged, and diff whitespace checks pass.

Final dimming revision: bun run check passed, including lint, TypeScript, Node tests, and Bun tests. Log: /tmp/groma437-dimming-check.log. Browser verification passed for dimming, clearing, label exclusion, focused-flow overlap, and reduced motion.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Selecting a component highlights direct neighbors and dims all other components. The selected shape reuses the flow pulse while its text stays steady, including when it is also a focused flow endpoint. Clearing selection restores normal brightness and reduced motion stops the pulse. Verified fixture browser behavior and the complete bun run check.
<!-- SECTION:FINAL_SUMMARY:END -->
