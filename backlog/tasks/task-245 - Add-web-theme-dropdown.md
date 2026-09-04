---
id: TASK-245
title: Add web theme dropdown
status: Done
assignee:
  - '@codex'
created_date: '2026-09-04 11:10'
updated_date: '2026-09-04 11:29'
labels: []
dependencies: []
references:
  - theme-control
  - page
  - render
modified_files:
  - src/viewers/web/atoms/theme.ts
  - src/viewers/web/chrome/theme-control.ts
  - src/viewers/web/page.ts
  - src/viewers/web/render.ts
  - src/viewers/web/url.ts
  - test-bun/theme.test.ts
  - test-bun/web-url.test.ts
  - docs/viewers/web/index.md
type: feature
ordinal: 284000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
The human architect can choose the web viewer theme from one dropdown. Auto follows the browser light or dark preference, while Light, Dark, and Blueprint remain explicit choices.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 The header theme control opens a dropdown ordered Auto, Light, Dark, Blueprint
- [x] #2 Auto renders the viewer in light or dark according to the browser color-scheme preference
- [x] #3 Light, Dark, and Blueprint each render their explicit whole-viewer theme
- [x] #4 The selected theme mode survives URL synchronization and reload
- [x] #5 A theme chosen from the dropdown persists for later visits in the same browser profile
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
1. Replace the cycling header button with one anchored dropdown that reuses the existing Web chrome menu primitives.
2. Separate the saved theme mode (Auto, Light, Dark, Blueprint) from the resolved palette theme; listen for browser color-scheme changes only while Auto is active.
3. Let a valid URL theme override the saved preference, use the saved preference when the URL is silent, persist dropdown choices, and keep Auto as the omitted URL default.
4. Update focused theme and URL tests plus the Web viewer contract.
5. Run focused checks, rendered Playwright validation, the repository check, then the required cold and full-context reviews.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Implementation:
- Replaced the theme cycle button with the shared anchored dropdown pattern.
- Kept the stored mode separate from the resolved palette: Auto resolves from prefers-color-scheme and updates when the browser preference changes.
- A valid URL theme has priority over saved state. When the URL has no theme, the saved mode is used. Auto stays canonical by being omitted from the URL.
- Stored dropdown choices in localStorage under groma.theme.

Verification:
- Focused theme and URL tests: 14 passed.
- Rendered Playwright check at 1440x900 on an isolated fixture: verified dropdown order, every palette, reload persistence, URL precedence, Auto media changes, and no browser console errors.
- bun run check passed: 104 Node tests and 273 Bun tests. Biome reported only the repository's 13 existing cognitive-complexity warnings, none in changed files.
- git diff --check passed. All changed source and test files remain under 500 lines.

Reviews:
- Cold simplicity review passed. Applied the clearer mode and applyTheme names. Kept the same-mode branch because it prevents an unnecessary full-page fade.
- Specification review found all five acceptance criteria satisfied.
- Quality review found no supported-flow defect, duplicate theme owner, obsolete cycle path, or unnecessary abstraction.
- Full-context complexity review recommended keeping the architecture unchanged: responsibilities are grouped by domain and the typed mode/palette split reduces junior-developer mistakes.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Added a persistent web theme dropdown with Auto, Light, Dark, and Blueprint. Auto follows live browser color-scheme changes; explicit modes persist in the browser profile and survive URL synchronization. Reused the existing palette, root theme attribute, transition, popover, and URL state architecture.
<!-- SECTION:FINAL_SUMMARY:END -->
