---
id: TASK-257
title: Show C4 level counts in the Web header
status: Done
assignee:
  - '@codex'
created_date: '2026-09-05 16:49'
updated_date: '2026-09-05 17:13'
labels: []
dependencies: []
references:
  - stats
  - render
  - page
modified_files:
  - src/viewers/web/chrome/stats.ts
  - src/viewers/web/render.ts
  - test-bun/web-stats.test.ts
  - src/viewers/web/page.ts
type: feature
ordinal: 296000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
When an architect reads the Web header beside the project name, show separate counts of systems, containers, and components instead of one combined element count. Prioritize these three C4 levels within the limited space, as requested in the supplied header screenshot.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 The header shows correct system, container, and component totals from the current architecture; actors and external systems are not counted as internal systems.
- [x] #2 Counts update with the displayed architecture and remain compact without overlapping header controls.
- [x] #3 Focused count logic tests, browser verification, and bun run check pass.
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
1. Reuse the current header statistics renderer and count elements by their C4 kind. 2. Show the three requested level counts with clear labels and preserve the existing compact-header behavior. 3. Verify kind counting, live/header rendering and layout, then run repository checks.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
The header shows systems, containers, and components with singular/plural labels. Browser verification at 1320 px found the longer count label squeezed the project name to zero width, so the existing compact-header cutoff now hides the secondary counts at 1400 px instead of 1280 px. Counts and project name fit at 1440 px.

Focused logic test passes: internal system/container/component totals include draft components and exclude actors and external systems without mutating the input. The current Groma model reports 1 system, 6 containers and 72 components. Shared-source fixture browser verification shows 1 system, 4 containers, 5 components; at 1440 px all labels fit beside the project name and before revision controls, and at 1320 px secondary counts hide with the project name retained and no header overflow. The existing renderer updates totals whenever its world changes. Cold simplicity and own specification/quality reviews pass. No content/color snapshot tests were added.

Final verification: focused C4 counting test and fixture browser checks pass. Lint and TypeScript pass; all 104 Node tests and 300 of 301 Bun tests pass. The architecture Markdown live-reload test timed out in the full suite, although it passed alone in 309 ms. AC 3 and check-related DoD remain unchecked; task stays In Progress. Full-context complexity review passed with no material recommendations. Audit report: /tmp/groma-opacity-audit/audit.md. No public contract or documentation changes are needed for these header labels.

The subsequent full shared-source bun run check passed, independently confirmed from /tmp/groma255-check6.txt: lint and types passed, 104 Node tests passed, 301 Bun tests passed, zero failures. The previous full-suite timeout no longer blocks completion. All acceptance criteria and Definition of Done items are now verified.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Replaced combined element/flow statistics with internal system, container and component totals. Verified counting logic and header layout at wide and compact widths. Full repository check passed: 104 Node and 301 Bun tests.
<!-- SECTION:FINAL_SUMMARY:END -->
