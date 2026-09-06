---
id: TASK-33
title: Cluster grouped siblings inside a labeled boundary
status: Done
assignee:
  - '@claude'
created_date: '2026-08-16 10:27'
updated_date: '2026-08-16 10:58'
labels: []
dependencies: []
ordinal: 26000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Element markdown may declare a group name in frontmatter. Siblings that share a parent and a group value are laid out clustered inside one labeled group boundary on the TUI map, matching how authors subjectively group same-kind elements in hand-drawn architecture views. Groups are a narrative overlay: they are orthogonal to C4 kinds and levels, never become parents, own no relationships, and are invisible to navigation. The group is authored manually per member; no scanner derives it.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 An element markdown file may declare `group: <name>` in frontmatter; a present group that is not a non-empty string fails loading with a clear error naming the file
- [x] #2 Siblings sharing the same parent and group value are laid out clustered inside one boundary labeled with the group name, at root level and inside any parent
- [x] #3 Groups are not selectable and navigation is unchanged: arrows still move between same-level element peers
- [x] #4 A world without group annotations renders exactly as before
- [x] #5 Running groma scan on elements that declare a group keeps the group annotation in their markdown
- [x] #6 The observed groma architecture declares one group whose labeled boundary is visible in groma view
- [x] #7 Tests cover group validation, clustered layout bounds enclosing exactly the members, and the rendered labeled boundary
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [ ] #1 Acceptance criteria have objective verification evidence.
- [ ] #2 Relevant checks pass and changes remain task-scoped.
- [ ] #3 Public contracts or documentation are updated when behavior changes.
- [ ] #4 Implementation Plan reflects the final approach; correction history and verification are recorded in Implementation Notes.
<!-- DOD:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. Add group to types: ArchitectureFrontmatter, ArchitectureElement, AnnotatedElement; add WorldGroup (id, name, parent, bounds) to ArchitectureWorld and ProjectedGroup (cellBounds) to WorldProjection.
2. architecture-model.ts: validate group is a non-empty string when present and copy it onto the element.
3. core.ts annotateRevision: carry group onto AnnotatedElement.
4. world-layout.ts: partition sibling nodes by group into synthetic ELK nodes (id group:<parent>:<name>) with label padding; collect group bounds during collectElements; include groups in edge-offset ancestry so routes inside a group stay correct.
5. projection.ts: project world groups to cell bounds alongside elements.
6. TUI: draw group boundaries (name on top border, dim) between component cards and container boundaries in organisms/world.ts, reusing drawBorder with a new group border style.
7. Annotate the two core components (architecture-model, world-layout) with one group in groma/observed as the visible example.
8. Tests: model validation (node test), layout clustering bounds (world-layout.test.ts), rendered boundary frame (test-bun), scan keeps group (scan or core test).
9. Docs: document the group frontmatter key where element authoring is described.
10. Verify with agent-tty at several sizes and levels; run bun run check.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Groups are synthetic ELK nodes (id group:<parent>:<name>) so members genuinely cluster; group ids share the node-id namespace with representationIds so edgeOffset can anchor routes on a group. WorldGroup/ProjectedGroup live in parallel arrays, never in elements, so navigation needed no change. Route labels gained boundary/group title rows as obstacles because the new layout reproduced a label erasing the Groma system title (4 viewer tests caught it). Two nearest-peer test expectations updated: the layout shift makes Scan reconciler the nearest peer; diagonal-jump UX flagged as follow-up chip, not this task. Cold simplicity review applied: seeds derived in one pass, flat bounds collection, direct name+parent matching in projection, one shared drawTitledFrame painter, group border delegates to the planned dash, no trim normalization, layout test folded into the shared fixture. Rejected: removing WorldGroup.parent (viewer would need core's id format, module-boundary test forbids the import); dropping boundary-title obstacles (fixes a failure this task reproduced).
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Element markdown may declare group: <name>; siblings sharing parent and group cluster inside one dim dashed boundary labeled with the name, at root and nested levels. Groups are narrative overlay only: not selectable, never parents, invisible to navigation; a group hides when all its members are hidden. Scan preserves the annotation; the observed groma architecture groups the two core components as World building. Verified with bun run check (typecheck, validate:architecture, 56 node tests incl. group validation/clustered-bounds/scan-preservation, 17 viewer tests incl. labeled-boundary and hidden-group frames) and agent-tty at 120x36 and 200x60: start view, containers, components, details; arrow round-trip frames identical, only header and selection ring change between arrows.
<!-- SECTION:FINAL_SUMMARY:END -->
