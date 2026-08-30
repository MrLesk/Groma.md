---
id: TASK-216
title: Round Web details tabs and reset them on selection
status: Done
assignee:
  - '@codex'
created_date: '2026-08-30 15:12'
updated_date: '2026-08-30 15:24'
labels: []
dependencies: []
references:
  - page
  - web-viewer-details
  - render
modified_files:
  - src/viewers/web/page.ts
  - src/viewers/web/organisms/details.ts
  - src/viewers/web/render.ts
  - test-bun/inspect-details.test.ts
  - docs/viewers/web/index.md
type: enhancement
ordinal: 229000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
The Web details tabs should read as one rounded segmented control using the same radius as other chrome buttons. When an architect leaves How it's built by selecting another architecture element, the new element should open on What it does instead of inheriting the previous tab.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 The details tab group has the shared button radius on its four outside corners while the seam between the two tabs stays square
- [x] #2 After viewing How it's built for one architecture element, selecting a different architecture element shows What it does
- [x] #3 Opening a direct view link with tab=how still opens How it's built for its initial selection
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
1. `src/viewers/web/page.ts`: define one shared control-radius token, use it for existing chrome controls, and clip the joined details tab group while explicitly keeping both button radii at zero.
2. `src/viewers/web/organisms/details.ts` and `src/viewers/web/render.ts`: keep the tab for the same primary selection and reset it to What it does when selection moves to another architecture item; leave initial URL state unchanged.
3. `test-bun/inspect-details.test.ts`: cover the selection-to-tab rule as navigation state.
4. `docs/viewers/web/index.md`: document the reset behavior and direct-link exception.
5. Verify with focused Bun tests, the repository check, cold and full-context simplicity reviews, and the browser flow.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Focused verification: `bun test test-bun/inspect-details.test.ts test-bun/web-url.test.ts` passes (16 tests).

Cold simplicity review: no findings; the reviewer confirmed the pure details-domain transition plus one renderer call is the smallest clear implementation.

Repository check attempt: `bun run check` reached TypeScript and was temporarily blocked by TASK-215 shared-workspace edits in `src/viewers/web/server.ts` and `src/viewers/web/source/structure.ts`; TASK-216 focused tests remained green.

Browser verification at `http://localhost:4757/?component=web-viewer-details&tab=how`: How it is built opened initially; the details tabs computed to a 6px parent radius with hidden overflow and square button radii; selecting Render changed the URL to `?component=render` and selected What it does. Browser warnings/errors: none.

Final repository check: lint and TypeScript passed; the Node suite passed 79/81 tests. The two filesystem-watch tests failed with the shared-session OS error `EMFILE: too many open files, watch`; an isolated rerun reproduced the same environment failure. The task-focused 16 tests pass.

Full-context complexity review: no blocking findings and no structural refactor recommended. Accepted its one in-scope defensive improvement: `#details .tabs button` now explicitly keeps radius 0 so a later generic button style cannot round the joined seam.

Post-review browser verification repeated the direct How link and component-switch flow. Computed styles were group radius 6px, overflow hidden, and both button radii 0px; selecting Render reset to What it does with no browser warnings or errors.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Rounded the Web details tabs as one shared-radius segmented control and made every new architecture selection return to What it does while preserving direct `tab=how` links. Verified with 16 focused tests, two browser interaction runs with computed-style checks and a clean console, and cold plus full-context simplicity reviews. The full repository check passed lint and TypeScript; its only two failures were unrelated filesystem-watch tests blocked by the shared session OS watcher limit.
<!-- SECTION:FINAL_SUMMARY:END -->
