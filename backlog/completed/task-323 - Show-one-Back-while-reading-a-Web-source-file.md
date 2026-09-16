---
id: TASK-323
title: Show one Back while reading a Web source file
status: Done
assignee:
  - '@cursor'
created_date: '2026-09-07 20:21'
updated_date: '2026-09-07 20:28'
labels: []
dependencies: []
references:
  - flow-controls
  - render
documentation:
  - docs/viewers/web/index.md
modified_files:
  - src/viewers/web/flow/state.ts
  - src/viewers/web/flow/reader.ts
  - src/viewers/web/render.ts
  - test-bun/web-flow-activation.test.ts
  - docs/viewers/web/index.md
  - features/flows.feature
type: bug
ordinal: 360000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
When an architect opens a component file during a flow visit, the details pane currently shows both Back (to the component) and Back to flow. Keep only the file Back. Restore Back to flow after the architect leaves the file, with the same scenario, step, and original return target.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Opening a source file from a flow endpoint shows Back to the component and does not show Back to flow
- [x] #2 Leaving that file restores Back to flow with the same scenario, step, and original return target
- [x] #3 The flow reader still offers return to the originating component when a flow was opened from element details
- [x] #4 The Web viewer guide describes this single Back stack
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
1. Add `flowReturn` in the Web flow state: given the active flow, whether the flow reader is showing, and whether a file is open, decide origin, flow, or no return.
2. Paint the flow-back button only from that decision, and paint source or task-diff first so a file reader occupies the Back slot.
3. Cover the decision with focused tests, including file-open suppressing flow return and leaving the file restoring it.
4. Describe the one-Back stack in the Web viewer guide.
5. Verify in the browser: flow endpoint → source (only Back) → Back (Back to flow returns) → Back to flow.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Paint source or task-diff first, then pass `source.file !== undefined` into `flowReturn` so only a file reader occupies the Back slot. Focused tests: 5/5 in test-bun/web-flow-activation.test.ts. First bun run check hit an unrelated web-startup port race (`an early browser request waits on startup`, EADDRINUSE 49280); that file passes alone (7/7). Retry of bun run check passed: 110 Node tests, 355 Bun tests, 6 pre-existing complexity warnings. Browser on http://localhost:4795: Observed Curation → Architect architecture curation showed Back to Observed curation; endpoint inspection showed Back to flow; src/curate.ts showed only Back (`source-back`, no `.flow-back`); Back restored How it's built and Back to flow with the same flow in the URL; Back to flow restored the reader and origin return. Specification review: AC1–AC4 have that evidence. Quality review: no extra abstraction beyond the return-target decision, no authority-backed blocker. Small navigation paint change, so no separate simplicity or complexity reviews.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
The Web details pane now shows one Back at a time during a flow visit. A source file keeps Back to the component; leaving the file restores Back to flow with the same scenario and origin return. Verified in the browser on Observed Curation → architecture curation → src/curate.ts, by flowReturn tests, and by bun run check (110 Node, 355 Bun).
<!-- SECTION:FINAL_SUMMARY:END -->
