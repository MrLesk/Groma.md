---
id: TASK-184
title: Add a holographic blue blueprint Web theme
status: Done
assignee:
  - '@codex'
created_date: '2026-08-27 07:45'
updated_date: '2026-08-27 08:13'
labels: []
dependencies: []
references:
  - page
  - render
  - iso-map
modified_files:
  - src/viewers/web/atoms/theme.ts
  - src/viewers/web/url.ts
  - src/viewers/web/render.ts
  - src/viewers/web/page.ts
  - test-bun/theme.test.ts
  - test-bun/web-url.test.ts
  - docs/viewers/web/index.md
ordinal: 196000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
A human architect can switch the Web viewer to a third Blueprint theme alongside Light and Dark. Blueprint uses a deep technical-blue field, crisp pale-cyan drafting lines, restrained luminous cyan, and selective green or red signal marks, inspired by the supplied architectural blueprint and holographic HUD references. It remains the same Groma design system: architecture meaning, layout, selection, work, flows, and the compass stay intact, while theme-specific visual decorations may change.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Pressing the header theme control cycles Light, Dark, Blueprint, then Light, with the control showing the next theme
- [x] #2 Blueprint applies a coherent blue technical palette to the full Web viewer while keeping architecture, hierarchy, details, work, routes, text, and interaction states readable
- [x] #3 Blueprint may use its own restrained drafting or holographic decorations, keeps the compass, and does not change map geometry or product behavior
- [x] #4 The selected theme survives a shareable URL and live world updates, and Blueprint works in both normal and exploded layer modes without coupling theme and mode
- [x] #5 Focused tests cover theme state and palette contracts, the Web documentation explains the three-theme cycle, and browser QA verifies all three themes without console errors
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
1. Replace the Web theme boolean with one explicit light/dark/blueprint theme domain, including palette, cycle order, and next-theme label.
2. Carry that theme through shareable URL state and live renderer updates while preserving TASK-183’s layer-mode changes.
3. Add the blueprint palette and restrained CSS-only drafting decorations, keeping the existing compass and map geometry.
4. Update focused theme, URL, page tests and Web viewer documentation.
5. Run focused tests, bun run check, browser QA in normal and layer modes, then complete the required simplicity and architecture reviews.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
## Selected direction

Selected **Midnight Reactor HUD** from three mockups. It preserves Groma’s existing viewer structure and compass, uses a dark navy blueprint field with pale cyan drafting lines, keeps green for active state, and limits red to sparse registration marks. The implementation should express this through the shared theme palette and restrained CSS decorations, without coupling theme state to layer projection or changing map geometry.

## Verification

Focused tests: `bun test test-bun/theme.test.ts test-bun/web-url.test.ts test-bun/web-page.test.ts` — 13 passed.

Repository check: `bun run check` — passed; 81 Node tests and 177 Bun viewer tests passed. Biome reported only the repository’s existing complexity warnings.

Browser QA at 1280×720: Light → Dark → Blueprint → Light used the correct next-theme labels and URL values; Blueprint preserved the compass and readable chrome/map state. F2 in Blueprint showed System, Container, and Component layers while preserving the theme and URL. Browser developer logs were empty.

Visual correction from QA: reduced Blueprint grid contrast and opacity after the first real browser capture showed a dense crosshatch at screen scale.

## Cold simplicity review

Passed with no findings. The reviewer reconstructed the flow as `WebTheme` → URL state → renderer theme state → root `data-theme` → shared CSS variables, and found the implementation direct, understandable, and already minimal. Focused tests were repeated: 13 passed.

## Specification and quality reviews

Specification review passed every acceptance criterion and Definition of Done item with no blocking findings. The reviewer also verified Blueprint through a watched world update.

Quality review found no blocking findings or material theme-specific follow-ups. Measured Blueprint contrast: ink 15.53:1, muted 7.02:1, accent 5.30:1. `git diff --check` was clean.

## Full-context architecture review

The review recommended keeping the architecture: the closed theme domain, palette record, URL boundary, one renderer state, and root CSS variables are minimal, easy to find, and hard to misuse. It identified one small duplicated mapping between the central cycle and icon selectors. Accepted the behavior-neutral cleanup: the button now carries the already-computed next theme, so its label and icon share one source of truth. Targeted re-review passed with no findings; focused tests, `bun run check`, browser cycle, accessibility state, and browser logs all remained clean.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Added Blueprint as a first-class third Web theme with a defensive Light → Dark → Blueprint cycle, shareable URL state, a coherent deep-blue palette, restrained HUD drafting decorations, and a shared next-theme icon/label contract. Theme state stays independent of live world updates and exploded layer mode. Verified with 13 focused tests, the complete `bun run check` suite (81 Node and 177 Bun tests), normal and exploded browser interaction at 1280×720, a real watched update, contrast checks, empty browser logs, cold simplicity review, specification review, quality review, and full-context architecture review.
<!-- SECTION:FINAL_SUMMARY:END -->
