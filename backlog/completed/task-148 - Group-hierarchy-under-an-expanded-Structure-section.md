---
id: TASK-148
title: Group hierarchy under an expanded Structure section
status: Done
assignee:
  - '@codex'
created_date: '2026-08-23 17:08'
updated_date: '2026-08-23 17:23'
labels: []
dependencies: []
references:
  - page
modified_files:
  - src/viewers/web/organisms/sidebar-section.ts
  - src/viewers/web/organisms/flows.ts
  - src/viewers/web/organisms/hierarchy.ts
  - src/viewers/web/page.ts
  - docs/viewers/web/index.md
type: enhancement
ordinal: 159000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
The web viewer hierarchy pane should present its containment tree under a Structure section that uses the same visual and interaction pattern as Flows. Structure starts expanded so the current hierarchy remains immediately visible, while both sections can be folded independently.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 The hierarchy tree appears under a Structure section whose heading matches the Flows section heading
- [x] #2 Structure starts expanded and its heading toggles the hierarchy tree without changing the architecture selection
- [x] #3 Flows keeps its existing default and toggles independently from Structure
- [x] #4 The web viewer documentation describes the Structure section
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
1. Extract the Flows heading into one domain-local sidebar section heading used by both sidebar organisms.
2. Wrap the hierarchy rows in a Structure section whose independent fold state starts expanded, and generalize the existing hierarchy-pane section styling.
3. Update the web viewer contract and verify both headings, independent folding, preserved selection, and focused checks.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Implemented one shared sidebar section heading used by Flows and Structure. Structure owns an independent fold state that starts expanded; Flows keeps its folded default.

Verification:
- Browser QA at 1252x720 showed matching computed heading styles, Flows=false and Structure=true initially, independent toggling, Groma selection/details preserved, and no console warnings or errors.
- The task-only change passed the full project check in an isolated clean worktree: TypeScript typecheck, 92 Node tests, and 142 Bun viewer tests. The isolated run was required because unrelated in-progress tasks overlap the shared worktree.
- git diff --check passed.

Reviews:
- The required cold simplicity review found no blocking or optional simplifications.
- The full-context architecture review found the shared domain-local heading plus independent local state to be minimal, clear, and resistant to junior-developer mistakes. No review changes were needed.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Grouped the web hierarchy tree under a Structure section that starts expanded and uses the same shared foldable heading as Flows. The two sections keep independent state, selection remains unchanged while folding, and the web viewer documentation now describes Structure.
<!-- SECTION:FINAL_SUMMARY:END -->
