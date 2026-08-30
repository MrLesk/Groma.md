---
id: TASK-216
title: Round Web details tabs and reset them on selection
status: Done
assignee:
  - '@codex'
created_date: '2026-08-30 15:12'
updated_date: '2026-08-30 16:45'
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
1. Keep the shared 6px control radius and the existing selection-reset behavior.
2. In `src/viewers/web/page.ts`, make the details tabs wrapper own the outer hairline and radius; remove child outer borders and draw only the center seam on the second tab.
3. Verify the direct How link, component-switch reset, computed border geometry, and the rendered left edge in the browser.
4. Run focused tests, the repository check, and the required simplicity and full-context reviews before finalizing again.
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

Correction reopened after rendered feedback showed the left rounded outline appearing cut. Root cause: the rounded wrapper clipped the square border owned by its first child button, so the curve had no continuous wrapper-owned hairline.

Corrected the Details tab border model in `src/viewers/web/page.ts`: the rounded wrapper now owns the one-pixel outer hairline; tab buttons have no outer borders; only the second button draws the center seam. This removes the clipped child-border curve without adding another visual concept.

Correction verification: 16 focused Bun tests pass. Browser QA at `http://localhost:4757/?component=web-viewer-details&tab=how` showed a continuous 1px wrapper hairline, 6px wrapper radius, borderless buttons, and one 1px center seam; selecting Render reset to What it does and the console had no warnings or errors. `bun run check` passed lint and TypeScript and 88/90 Node tests; the same two filesystem-watch tests remained blocked by shared-session `EMFILE` watcher exhaustion.

Correction reviews: the cold simplicity reviewer and full-context complexity reviewer found no blocking or optional changes. Both confirmed the three adjacent rules make border ownership explicit and safe: wrapper owns the outside, buttons own content/fill, second button owns the seam.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Rounded tabs now have one continuous wrapper-owned hairline instead of clipped child borders, so the outer curve no longer looks cut. The square center seam, direct `tab=how` link, and reset to What it does remain intact. Verified with 16 focused tests, browser geometry and interaction checks, a clean browser console, and two simplicity reviews; the full check passed lint, TypeScript, and 88/90 Node tests, with only the shared-session `EMFILE` watcher failures remaining.
<!-- SECTION:FINAL_SUMMARY:END -->
