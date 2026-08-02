---
id: TASK-17.5.8
title: Make ngx-vflow slider proof synchronize deterministically
status: Done
assignee:
  - '@codex'
created_date: '2026-07-30 23:20'
updated_date: '2026-07-31 00:08'
labels: []
dependencies: []
references:
  - e2e/semantic-zoom-proofs.spec.js
  - src/spikes/semantic-zoom/proofs/angular-proofs.jsx
modified_files:
  - e2e/semantic-zoom-proofs.spec.js
parent_task_id: TASK-17.5
priority: high
type: bug
ordinal: 33000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
The ngx-vflow browser proof intermittently observes native stage zoom 1.02 while the shared continuous slider already reports 0.38. The proof must deterministically synchronize its assertion with ngx-vflow's documented native viewport/event state so the shared control result is stable without weakening the exact Revision 04 interaction contract.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 A focused browser check reproduces and records the intermittent ngx-vflow native-stage versus slider mismatch.
- [x] #2 The proof waits for documented ngx-vflow native viewport or event state before asserting slider synchronization, without fixed sleeps or generic retries that hide the mismatch.
- [x] #3 The shared plus, minus, continuous slider, named landmarks, exact fixed geometry, and native viewport behavior remain unchanged.
- [x] #4 Focused repeated and sequential browser runs pass deterministically with objective native zoom and slider evidence.
- [x] #5 No fallback, compatibility behavior, hardening, or unrelated candidate changes are introduced.
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
1. Capture the exact zoom requested by the real continuous range input for ngx-vflow.
2. Wait for the existing stage `data-zoom`, sourced from ngx-vflow’s documented `VflowComponent.viewportChange$`, to equal that request before asserting the controlled slider value; leave Foblex, controls, landmarks, geometry, and native interactions unchanged.
3. Verify the focused proof under repeated stress and sequential coverage, then run the complete semantic comparison and browser suites.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
2026-07-31 TDD/reproduction: `npx playwright test --config playwright.semantic-zoom.config.mjs --grep "ngx-vflow preserves" --repeat-each=30` failed 3/30 before the change at the slider synchronization assertion. Each failure froze expected slider 0.38 before ngx-vflow delivered native/event-mirrored stage zoom 1.02. Root cause: the matcher expected argument was evaluated once immediately after the controlled range click, on the pre-`viewportChange$` render; the poll then observed only the later native zoom.

Smallest correction: for ngx-vflow only, the browser proof records the value emitted by the real range `input` event, waits for stage `data-zoom` (updated by the existing documented `VflowComponent.viewportChange$` callback) to equal that exact request, then requires the controlled slider to equal it. No production code, control, landmark, geometry, camera, native interaction, fallback, retry, or other candidate behavior changed. The first edit matched the identical earlier Vue-family block; a repeated ngx-vflow run exposed the unchanged Angular assertion, so that edit was fully reverted and applied only in the Angular candidate loop.

Verification: focused ngx-vflow 1/1 passed; the same 30x single-worker repetition passed 30/30; sequential ngx-vflow interaction, Foblex-to-ngx-vflow switch, and ngx-vflow readability passed 3/3; `node --test test/semantic-zoom-comparison.test.mjs` passed 11/11; `npm run test:semantic-zoom:browser` passed 31/31 with one worker; `node --check e2e/semantic-zoom-proofs.spec.js`, `git diff --check`, and the targeted trailing-whitespace scan passed. The full browser output retained the already-authored F6 and ngx-graph terminal-error evidence while reporting zero test failures.

Final review and stress evidence: the cold simplicity, specification, and quality reviews all passed with no authority-backed blocking finding. The final ngx-vflow quality stress passed 50/50. Two complete single-worker semantic browser suites passed 31/31 each (62/62 total), in addition to the earlier focused 30/30, sequential 3/3, and semantic contract 11/11 evidence. Review confirmed the change is confined to the browser proof assertion, uses only the existing documented native viewport event mirror, and adds no sleep, generic retry, fallback, compatibility behavior, custom camera, private API, weakened assertion, production behavior, or documentation obligation.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Made the ngx-vflow browser proof synchronize its controlled slider assertion with the exact native zoom request confirmed through the documented `viewportChange$` stage state, eliminating the pre-event 0.38 versus 1.02 race without changing controls, geometry, or renderer behavior. The baseline failed 3/30; final evidence passed focused 30/30, quality stress 50/50, sequential 3/3, semantic contract 11/11, and two full browser suites 62/62, with simplicity, specification, and quality reviews all passing.
<!-- SECTION:FINAL_SUMMARY:END -->
