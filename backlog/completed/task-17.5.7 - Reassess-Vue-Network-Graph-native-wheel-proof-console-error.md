---
id: TASK-17.5.7
title: Reassess Vue Network Graph native wheel proof console error
status: Done
assignee:
  - '@codex'
created_date: '2026-07-30 23:20'
updated_date: '2026-07-30 23:46'
labels: []
dependencies: []
references:
  - e2e/semantic-zoom-proofs.spec.js
  - src/spikes/semantic-zoom/comparison-data.mjs
modified_files:
  - e2e/semantic-zoom-proofs.spec.js
  - src/spikes/semantic-zoom/comparison-data.mjs
  - src/spikes/semantic-zoom/proofs/vue-network-graph-proof.jsx
  - test/semantic-zoom-comparison.test.mjs
  - groma/experiments/04-semantic-zoom-viewer/library-selection.md
parent_task_id: TASK-17.5
priority: high
type: bug
ordinal: 32000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
When an evaluator exercises the Vue Network Graph proof through its native wheel interaction, the browser currently reports 'Unable to preventDefault inside passive event listener invocation.' The proof must either demonstrate a clean native wheel path through documented public configuration/APIs or honestly reclassify the candidate with retained browser evidence, without hiding console failures.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 The existing Vue Network Graph proof reproducibly captures the exact passive-listener console error during a native wheel interaction.
- [x] #2 The reassessment uses only Vue Network Graph's documented public configuration and APIs; it adds no custom camera, fallback, compatibility layer, or private event interception.
- [x] #3 If a clean native wheel path cannot be achieved within the public API, the candidate is reclassified to the observed terminal result with visible executable evidence.
- [x] #4 The 131-candidate comparison, focused browser tests, and evidence text agree with the verified outcome.
- [x] #5 No broad console-error filtering or message suppression is introduced.
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
1. Retain the pinned Vue Network Graph public mount with the authored 15-element, 18-relationship fixed-layout scene and native mouse-wheel zoom enabled.
2. Present the exact reproduced passive-listener console error as visible terminal runtime evidence and classify the candidate as `runtime-failure` in the 131-candidate comparison and selection evidence.
3. Protect the result with focused browser and unit coverage that triggers a real native wheel event, expects the exact unsuppressed console error, and verifies the retained mounted evidence without live-proof controls or private interception.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
2026-07-31 root-cause checkpoint: Browser-plugin selection returned no available browser instances, so the repository's explicit Playwright browser workflow is the permitted fallback for this task's objective browser requirement. The existing focused test reproducibly failed after native `page.mouse.wheel(0, -180)` with exactly `Unable to preventDefault inside passive event listener invocation.` Console location points to the pinned `v-network-graph@0.9.23` bundled `setupContainerInteractionHandlers` wheel `preventDefault()` callback. The native transform and Wheel status still change, proving the error occurs on the required library interaction rather than during mount. Official configuration documentation exposes `view.mouseWheelZoomEnabled` only as an enable/disable flag and no passive-listener/default-prevention control; methods expose zoom/pan operations but no wheel-listener configuration. The pinned library hardcodes its underlying svg-pan-zoom `preventMouseEventsDefault: false`, while separately invoking `preventDefault()` for enabled wheel zoom. Disabling wheel is outside the native-wheel requirement, and private listener interception or dependency patching is prohibited. Final approach: retain the mounted graph as executable evidence and honestly reclassify it to the exact reproduced runtime limitation.

2026-07-31 implementation and verification: TDD RED proved both contracts were absent: the focused unit test expected `runtime-failure` but received `live-proof`, and the focused browser test found the exact mounted graph but no terminal result UI. The minimal GREEN changed only the candidate evidence, mounted proof presentation, focused tests, and selection evidence. The graph remains executable with 15 `[data-element-id]` nodes and 18 native `.v-ng-line` relationships. A real `page.mouse.wheel(0, -180)` changes the native SVG transform and marks Wheel observed, while the test captures exactly `["Unable to preventDefault inside passive event listener invocation."]`; page errors remain empty and no console filter/suppression was added. Focused unit test passed 1/1; complete comparison unit file passed 11/11; Vue-family browser focus passed 4/4; full semantic-zoom browser suite passed 31/31. `npm run check` passed architecture validation (5 revisions, 51 elements, 52 relationships) and all 119 Node tests. Disposable Vite production build passed after transforming 6,223 modules; emitted warnings are existing third-party candidate warnings unrelated to this change. `git diff --check` and no-index whitespace checks for all five shared untracked task files passed. Rendered QA at 1600x1000 confirmed the intended URL/title, meaningful 131-candidate page content, no framework overlay, visible runtime badge/exact error, 15 nodes, 18 edges, native wheel transform change, zero page errors, and the one expected unsuppressed console error. Screenshot: `/tmp/task-17-5-7-vng-runtime-limitation.png` (outside the repository). TASK-17.5.7 intentionally remains In Progress with acceptance criteria and Definition of Done unchecked for orchestrator review.

2026-07-31 accepted cold-simplicity correction for targeted re-review: added a browser RED guard for decisive terminal evidence only; it failed because the former live Continuous zoom slider remained (`expected 0, received 1`). Reduced `vue-network-graph-proof.jsx` from 385 to 221 lines. The proof now retains only the public `VNetworkGraph` mount, 15-node/18-edge data, fixed layouts, static public configuration with native wheel enabled, node template, runtime badge, and visible exact error. Deleted `VueNetworkGraphControls`, semantic-zoom imports/state/opacity, active-level/zoom/instance/wheel/pan refs, interaction state, capture handlers, semantic data attributes, Wheel/Pan/Controls status rows, and the unused methods link. The browser test retains mounted counts, terminal UI, zero page errors, a real native wheel action, and an exact unsuppressed console assertion; transform-change and Wheel-observed assertions were removed. After deletion, the first focused run read the console array before the asynchronous browser message arrived; a diagnostic real-wheel run confirmed the native transform still changed and the same library error still emitted, so the test now polls only for the exact console error and restores no harness machinery. Verification: focused VNG browser 1/1; comparison unit file 11/11; Vue-family browser 4/4; full semantic-zoom browser 31/31; `npm run check` passed architecture validation (5 revisions, 51 elements, 52 relationships) and 119/119 Node tests; disposable Vite build passed after 6,223 modules with the same unrelated third-party warnings; `git diff --check` and no-index whitespace checks passed. Rendered 1600x1000 QA confirmed 15 nodes, 18 edges, zero sliders/Pan/Controls status, visible runtime badge/exact error, no framework overlay or page error, and exactly the unsuppressed passive-listener console error. Screenshot: `/tmp/task-17-5-7-vng-simplified.png` outside the repository. Plan, status, acceptance criteria, and Definition of Done remain unchanged for targeted re-review.

2026-07-31 final review checkpoint: cold simplicity targeted re-review, specification review, and quality review all PASS. No authority-backed blocking findings remain. Finalization uses the previously recorded current objective verification.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Reclassified Vue Network Graph 0.9.23 as a retained mounted runtime failure because its documented public API cannot keep native wheel zoom enabled without the exact passive-listener console error. Verified the 15-node/18-edge mount, real native-wheel exact unsuppressed error, aligned 131-candidate evidence, focused and full browser coverage (31/31), Node tests (119/119), architecture validation, production build, and all reviews PASS.
<!-- SECTION:FINAL_SUMMARY:END -->
