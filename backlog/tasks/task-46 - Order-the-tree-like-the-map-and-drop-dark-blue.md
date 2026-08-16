---
id: TASK-46
title: Order the tree like the map and drop dark blue
status: Done
assignee:
  - grok
created_date: '2026-08-16 16:41'
updated_date: '2026-08-16 16:48'
labels: []
dependencies: []
references:
  - src/viewers/tui/tree.ts
  - src/viewers/tui/atoms/theme.ts
documentation:
  - docs/viewers/tui/index.md
priority: high
type: feature
ordinal: 50000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Container marks use dark blue and are hard to read on the map. The hierarchy lists siblings by architecture id, so people, systems, and external systems are mixed and do not match the map. Use a readable container color. Order siblings by meaning (people, then internal software, then externals) and left to right on the map within each group.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Container marks are not dark blue and stay readable on the map
- [x] #2 The tree lists people, then systems, then external systems; siblings in a group follow the map left to right
- [x] #3 Viewer tests cover sibling order without asserting decorative colors
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
1. Compare siblings by meaning (person, internal, external), then map x, then y, then id. Tree, Enter first-child, and default selection share that order.
2. Color containers from a mix of the blue slot and the terminal foreground so the mark is not dark blue.
3. Update TUI docs. Test root order on the navigation fixture.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Simplicity dropped the extra live-repo order test and the representationId tiebreak. bun test test-bun/terminal-viewer.test.ts 23/23; tsc pass. Spec and quality PASS.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
The hierarchy now lists people, then systems, then external systems, left to right like the map. Container marks mix bright blue toward the terminal foreground so they are not dark blue. Verified with bun test test-bun/terminal-viewer.test.ts (23/23), tsc, and specification/quality reviews.
<!-- SECTION:FINAL_SUMMARY:END -->
