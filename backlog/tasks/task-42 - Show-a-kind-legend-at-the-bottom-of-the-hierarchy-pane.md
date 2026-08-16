---
id: TASK-42
title: Show a kind legend at the bottom of the hierarchy pane
status: Done
assignee:
  - grok
created_date: '2026-08-16 14:42'
updated_date: '2026-08-16 14:48'
labels: []
dependencies: []
references:
  - src/viewers/tui/organisms/hierarchy.ts
documentation:
  - docs/viewers/tui/index.md
priority: high
type: feature
ordinal: 46000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
The hierarchy pane now marks each row with a kind glyph, but the marks have no key in that pane. Put the four kind marks and their names at the bottom of the hierarchy pane so the tree explains itself.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 The bottom of the hierarchy pane shows the person, system, container, and component marks with their names
- [x] #2 Tree rows scroll above the legend and do not draw on top of it
- [x] #3 Viewer tests cover the legend without asserting decorative layout
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
1. Reserve the last rows of the hierarchy interior for a kind legend that reuses kindGlyph and kindLabel.
2. Scroll the tree in the remaining height so the cursor stays in the tree window.
3. Mention the legend in the TUI docs. Assert the four marks appear at the bottom of the hierarchy pane.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
bun test test-bun/terminal-viewer.test.ts 22/22; tsc pass. Simplicity, specification, and quality reviews PASS.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
The hierarchy pane now ends with a kind legend: person, system, container, and component marks with their names. The tree scrolls in the space above it. Verified with bun test test-bun/terminal-viewer.test.ts (22/22), tsc, and specification/quality reviews.
<!-- SECTION:FINAL_SUMMARY:END -->
