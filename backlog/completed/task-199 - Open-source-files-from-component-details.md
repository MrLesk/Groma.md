---
id: TASK-199
title: Open source files from component details
status: Done
assignee:
  - '@codex'
created_date: '2026-08-27 20:16'
updated_date: '2026-08-27 21:02'
labels: []
dependencies: []
references:
  - source-viewer
  - shell
  - web-viewer-details
  - render
  - web-server
  - page
  - web-viewer-chrome
  - lint-web-scrollbars
modified_files:
  - src/viewers/web/source/read.ts
  - src/viewers/web/source/view.ts
  - src/viewers/web/source/control.ts
  - src/viewers/web/atoms/theme.ts
  - src/viewers/web/organisms/details.ts
  - src/viewers/web/url.ts
  - src/viewers/web/server.ts
  - src/viewers/web/page.ts
  - src/viewers/web/render.ts
  - test-bun/theme.test.ts
  - test-bun/web-url.test.ts
  - test-bun/web-live.test.ts
  - >-
    groma/observed/systems/groma/containers/web-viewer/components/source-viewer.md
  - groma/observed/systems/groma/containers/web-viewer/components/render.md
  - design-qa.md
  - src/viewers/web/atoms/chrome.ts
  - src/viewers/web/revision/view.ts
  - src/viewers/web/work/island.ts
  - scripts/lint-web-scrollbars.ts
  - package.json
  - groma/observed/systems/groma/containers/web-viewer/components/page.md
  - >-
    groma/observed/systems/groma/containers/web-viewer/components/web-viewer-chrome.md
  - >-
    groma/observed/systems/groma/containers/cli/components/lint-web-scrollbars.md
type: feature
ordinal: 211000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
A developer can move from a component's exact Code reference to its read-only source without leaving the Groma architecture context. The file view follows the approved inspector drill-down mockup and gives each of Groma's three themes a distinct, readable source syntax palette.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 When a developer selects a component, opens How it's built, and activates an exact Code file, the details pane shows that file's read-only source with line numbers while the component remains selected on the map
- [x] #2 The file view has a clear Back action that returns to the selected component's How it's built view
- [x] #3 The selected source file is represented in the URL and direct navigation restores the same component and file view
- [x] #4 Source is loaded for the active revision on demand and historical architecture never displays current-revision source
- [x] #5 Light, dark, and blueprint themes each render a distinct, readable syntax-highlight palette
- [x] #6 Focused tests cover file selection, URL state, revision-bound source loading, and Back navigation; bun run check passes
- [x] #7 At 1280x720, source mode expands the details pane enough to show an 80-character source line plus line numbers and padding without horizontal scrolling
- [x] #8 Back uses the shared platform button treatment, and every scrollable Web surface inherits one compact scrollbar treatment instead of browser-default or local variants
- [x] #9 The repository check rejects scrollbar styling outside the shared Web chrome atom
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
1. Keep the revision-bound source read, URL ownership validation, and source-viewer read/control/view domain unchanged.
2. Promote standalone chrome-button and compact-scrollbar styling into one shared Web chrome atom; make source Back consume the button atom and every overflow surface inherit the scrollbar atom.
3. Expand only source-mode details to the measured width required for 80 code characters, line numbers, and padding while preserving the remaining map viewport.
4. Remove revision and work-island scrollbar overrides so one global compact rule is authoritative.
5. Add a repository lint guard that rejects scrollbar styling outside the shared atom and include it in bun run check.
6. Re-run focused tests, full checks, and browser QA at 1280x720 across all themes, then repeat the cold simplicity review.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Context: TASK-192 currently owns revision history across server.ts, payload.ts, render.ts, page.ts, url.ts and related tests. TASK-199 will preserve those changes and use its selected revision as the sole source-read identity. TASK-156 makes on-demand source loading preferable to enlarging the map payload.

Verification: browser direct navigation restored Details source mode at the exact component-owned file; Back removed only file state and returned to How it's built; 1024x720 had no body overflow; light, dark, and blueprint captures are /tmp/task-199-*-v2.png; browser logs were empty. Design comparison passed in design-qa.md. bun run check passed with 81 Node tests and 189 Bun tests.

Cold simplicity review: Details Code button -> source control -> revision-bound /source.json -> existing Git snapshot reader -> source painter. Removed unused file, scanner, and line-count response fields and the hidden duplicate meta write. The remaining read/control/view split groups the atomic parts by source-viewer domain, keeps render.ts at 497 lines, and makes the exact-file and exact-revision rules hard to bypass for junior changes. No further in-scope code or indirection can be removed without combining browser state, server I/O, and rendering responsibilities.

Alex reopened visual review: Back must use the platform button language; source mode must fit 80 characters plus line numbers comfortably; compact scrollbars must be global and locally divergent scrollbar CSS must be rejected by the repository check. Shared-file edits remain paused until TASK-192 finishes its commit.

Reopened correction implemented: shared Web viewer chrome owns standalone buttons and compact scrollbars; local revision/work scrollbar CSS was removed; source mode expands details to 640 px; a check guard rejects scrollbar CSS outside the chrome atom. Architecture ownership is recorded once under web-viewer-chrome.

Final browser QA at 1280x720: source details settled at 640 px with 627 px available to source; the measured 80-character line plus line numbers and padding needs 594 px; body clientWidth and scrollWidth both remained 1280. Back cleared only file state, reopening restored source mode, and direct reload restored 424 lines. Light, dark, and blueprint captures are /tmp/task-199-*-v3.png; comparison is /tmp/task-199-comparison-v3.png. Computed scrollbar-width was thin on hierarchy and details surfaces.

Validation: scrollbar guard and typecheck passed; the focused watch test passed alone after one concurrent focused-run timeout; final bun run check passed with 81 Node tests and 189 Bun tests. render.ts remains 497 lines. Cold simplicity review followed Code button -> source control -> revision-bound source endpoint -> existing Git snapshot -> source painter. The correction adds only one shared chrome CSS atom, one source-mode width state, and one 15-line guard; local scrollbar variants were deleted. The flow is direct, domain-grouped, and no accepted behavior or indirection can be removed without losing the global design-system rule or revision/file safety.

Final Back correction: the shared chrome button now uses an exact 32 px border-box height matching the platform control group, and source Back includes an aria-hidden left arrow while keeping the accessible name Back.

Visual QA v4: Back now renders as ← Back at exactly 32 px high, matching the 32 px Fit control. Its arrow is aria-hidden so the accessible name remains Back. Browser interaction still clears only file state; direct source navigation restores the view. Final screenshots are /tmp/task-199-*-v4.png and comparison is /tmp/task-199-comparison-v4.png.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Added revision-bound component source drill-down in the existing details pane, three theme-specific syntax palettes, a 640 px source mode, shared platform Back styling, and one compact scrollbar treatment guarded by the repository check. Verified URL restore and Back in the browser, measured 80-character fit at 1280x720, compared all three themes against the approved mock, and passed bun run check (81 Node, 189 Bun).
<!-- SECTION:FINAL_SUMMARY:END -->
