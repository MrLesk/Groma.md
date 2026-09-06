---
id: TASK-129
title: Use the Groma accent colour for checked acceptance-criteria checkmarks
status: Done
assignee:
  - '@codex'
created_date: '2026-08-23 13:08'
updated_date: '2026-08-23 13:34'
labels: []
dependencies: []
references:
  - render
modified_files:
  - src/viewers/web/organisms/details.ts
  - src/viewers/web/page.ts
type: enhancement
ordinal: 140000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
When a person opens a Backlog task in the web viewer's details pane, checked acceptance criteria should use Groma's accent colour for their checkmarks. This makes completion state consistent with the viewer's existing visual language without changing the criterion text or unchecked items.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 In the web task-details pane, every checked acceptance criterion shows its checkmark in Groma's accent colour
- [x] #2 Criterion text and unchecked acceptance criteria keep their existing appearance
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
1. In src/viewers/web/organisms/details.ts, render a checked criterion's checkmark as its own domain-named span while keeping the criterion text under the existing ghost treatment; leave unchecked rows unchanged.
2. In src/viewers/web/page.ts, colour that checkmark with the existing --accent theme token.
3. Run the focused project checks and verify the rendered class/token relationship without adding a decorative-content test.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Implemented the checked criterion as a full-opacity criterion-check span beside the existing muted criterion text; the span uses the shared --accent token in the details pane, while unchecked rows keep their original text node. No automated test was added because the project excludes decorative-detail assertions. bun run check passed: 92 Node tests and 136 Bun tests; git diff --check passed.

Cold simplicity review: no blocking or non-blocking findings. The reviewer confirmed that separating the mark from the muted text is necessary because parent opacity would also mute the mark, and found the domain-specific class and direct branch easy to follow. Full-context architecture review: no required corrections; keep the implementation unchanged. Optional future observation only: if details-specific styles grow, move the complete details style group into its domain in one coherent refactor rather than moving this one rule now.

Rendered verification with Playwright fallback at 1280x800 against http://localhost:4747: unfolded Live work and selected TASK-128; its 3 checked criteria each rendered a criterion-check whose computed colour rgb(29, 158, 117) exactly matched --accent, mark opacity was 1, and criterion text opacity stayed 0.5. Opening ?task=TASK-129 showed both unchecked rows with their original circle text and no criterion-check nodes. Page identity was groma.md, the SVG map, hierarchy and details rendered, no framework overlay appeared, and console errors/warnings were empty. Screenshots: /tmp/groma-task129-checked.png and /tmp/groma-task129-unchecked.png. Browser plugin invocation had failed earlier, so the project-permitted Playwright test-runner fallback was used.
<!-- SECTION:NOTES:END -->

## Comments

<!-- COMMENTS:BEGIN -->
author: @claude
created: 2026-08-23 13:15
---
A tracking script of mine (TASK-130, @claude) overwrote this task's modified-file list at about 13:15 UTC with map.ts, pins.ts, style.ts and docs/viewers/web/index.md, which are not yours. I restored it from the tree (details.ts, page.ts); please correct the order or entries if they differ.
---
<!-- COMMENTS:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Checked acceptance criteria now render a full-strength Groma accent checkmark while their text keeps its existing muted appearance; unchecked criteria are unchanged. Verified through the live web viewer with Playwright, full project checks (92 Node and 136 Bun tests), diff checks, and both simplicity reviews.
<!-- SECTION:FINAL_SUMMARY:END -->
