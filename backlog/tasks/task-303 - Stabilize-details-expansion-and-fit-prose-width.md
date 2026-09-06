---
id: TASK-303
title: Stabilize details expansion and fit prose width
status: Done
assignee:
  - '@codex'
created_date: '2026-09-06 14:21'
updated_date: '2026-09-06 14:31'
labels: []
dependencies: []
references:
  - web-shell
  - page
  - web-viewer-authoring
modified_files:
  - src/viewers/web/chrome/shell.ts
  - features/details-panel.feature
  - docs/viewers/web/index.md
type: bug
ordinal: 341000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
An architect can expand normal details into a 640px reading column with normal padding, while source and diffs retain their current wider layout. Expansion and collapse stay smoothly animated without repeated text reflow or shifting Edit, Expand and Close controls. All content continues to use the existing shared panel and manual width choice.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Expanded normal details fit a 640px content column plus ordinary padding; narrow screens fit the viewport without empty centered gutters.
- [x] #2 Source and diff views retain their current expanded width and useful code reading layout.
- [x] #3 Expansion and collapse remain smoothly animated while content keeps a stable layout during the motion and Edit, Expand and Close do not jitter.
- [x] #4 The shared manual width choice, selection, camera, reading flow and unsaved editing remain intact.
- [x] #5 Browser verification and bun run check pass, documentation describes the final behavior, and the required final complexity review is completed.
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
1. Separate target content width from animated panel width in shared CSS; keep the current code width and fit normal details around 640px. 2. Stabilize the scrollbar allocation and panel controls without repainting content on width changes. 3. Verify normal details, code/diffs, editing, responsive widths and animated transitions in the browser; run the repository check. 4. Complete the final full-context complexity review, record evidence, then commit and push only task-owned changes.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Implemented the correction entirely in shared panel CSS. A target-width custom property sets content layout immediately, while the panel retains its existing 260ms width transition. Normal expansion is 640px of content plus 48px padding and 2px border; source/diffs retain their previous responsive widths. Stable scrollbar space removes control shifts, and file toolbar spacing keeps the line count clear of the controls. No JavaScript controller, rendering callback, architecture, OKF metadata, C4 meaning or saved data changed. The existing Web shell owns this presentation behavior for every project and language. Browser frame sampling verified expansion and collapse across 31 distinct widths: content width and height each stayed constant, and Edit/Expand/Close coordinates stayed identical. The actual Edit form kept unsaved text through collapse. Verified 390px viewport with 366px panel, 640px desktop prose content, 1044px source at 1440px and 960px diff at 1920px; Back returned to the 690px prose panel with the manual expanded choice and reading scroll preserved. bun run check passed: 106 Node tests and 329 Bun tests, zero failures, six existing lint warnings outside changed code. Implementer simplicity, specification and quality reviews found no blocking issue. Final full-context complexity review follows.

Final full-context complexity review found no material findings: fixed target content width plus the existing panel transition is the simplest sufficient approach, remains in the Web shell, and needs no additional controller or abstraction. Narrow source verification also passed: 366px panel in a 390px viewport, with code horizontally scrollable inside the reader and no horizontal page overflow.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Fitted expanded normal details around a 640px content column while retaining the wider source/diff layout. Preserved smooth width animation with fixed content layout and stable control positions. Verified intermediate animation frames, mobile/desktop layout, code and diff return, unsaved editing, and the complete repository check: 106 Node and 329 Bun tests passed. Final complexity review found no material changes needed.
<!-- SECTION:FINAL_SUMMARY:END -->
