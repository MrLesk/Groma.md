---
id: TASK-151
title: Group Structure roots by architecture kind
status: Done
assignee:
  - '@codex'
created_date: '2026-08-23 17:50'
updated_date: '2026-08-23 18:00'
labels: []
dependencies:
  - TASK-150
references:
  - page
modified_files:
  - src/viewers/web/organisms/hierarchy.ts
  - src/viewers/web/page.ts
  - docs/viewers/web/index.md
ordinal: 162000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
The web hierarchy pane should keep Structure as its single foldable section and organize its real root rows under non-interactive Actors, Systems, and External systems labels. The labels clarify the architecture taxonomy without adding fake elements or more fold state.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Structure shows non-empty Actors, Systems, and External systems groups in that order
- [x] #2 Each existing hierarchy root appears once in the group derived from its kind and external status, while descendants stay beneath their system
- [x] #3 The group labels do not add independent folding; Structure and system-row folding keep their current behavior
- [x] #4 The web viewer documentation describes the grouped Structure hierarchy
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
1. Insert non-interactive group labels at real root boundaries in the web hierarchy renderer, relying on the existing actors/internal/external root order and leaving descendant rows unchanged.
2. Style the labels as quiet nested taxonomy inside Structure without adding another fold control.
3. Update the web viewer contract and verify grouping, Structure folding, system-row folding, selection preservation, and rendered health.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Implemented presentation-only root grouping in the web hierarchy renderer. The existing root ordering supplies Actors, internal Systems, and External systems; labels are inserted only at non-empty root boundaries, while each root and its descendants keep the existing TreeRow flow and controls.

The cold simplicity review found no code or styling simplification. Accepted its only optional clarification by naming authored sibling groups as the groups omitted from the tree, distinguishing them from the visible Structure labels.

The full-context architecture review found the design minimal, domain-local, and resistant to junior-developer mistakes. Accepted its only optional improvement by renaming groupName to rootGroupName so the depth-zero precondition is explicit.

Delivery depends on TASK-150 because the visible Actors group uses its canonical actor kind. TASK-150 is complete; TASK-151 will be committed only after that prerequisite reaches main, so the commits stay isolated.

Verification:
- Browser QA at 1252x720 showed Actors, Systems, and External systems in order with four real root rows and no controls inside labels.
- Collapsing Structure hid the groups while keeping Flows folded, selected Groma, and Groma details unchanged; restoring Structure returned the groups.
- Expanding Groma increased visible rows from 4 to 10, kept External systems after the six descendants, and preserved selection/details. Browser logs contained no warnings or errors.
- The final task-only checkout on the merged origin/main base passed the full project check: TypeScript, 93 Node tests, and 150 viewer tests. Focused web-page/tree checks passed 6/6 and git diff --check passed.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Grouped the web Structure hierarchy under non-interactive Actors, Systems, and External systems labels while preserving the existing root rows, descendants, selection, and fold behavior. Reused the current hierarchy ordering and metadata typography, updated the web contract, verified the interactions in-browser, passed cold and full-context simplicity reviews, and passed the full project check.
<!-- SECTION:FINAL_SUMMARY:END -->
