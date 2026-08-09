---
id: TASK-28.3
title: Supply annotated architecture through Groma core
status: To Do
assignee: []
created_date: '2026-08-09 20:01'
updated_date: '2026-08-09 20:37'
labels: []
dependencies: []
references:
  - docs/product-model.md
  - docs/viewer.md
  - groma/plans/mvp/README.md
  - groma/README.md
parent_task_id: TASK-28
priority: high
type: feature
ordinal: 1500
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
When `groma view` requests architecture, Groma core loads every C4 element document from observed, missing, and every plan, resolves the complete renderer-independent model, and returns that model for layout and viewing. README files and other Markdown without C4 element frontmatter are not architecture items. Viewer code receives data from core and never reads architecture directories itself.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 A viewer request makes core load every C4 element document under `groma/observed/`, `groma/missing/`, and every directory under `groma/plans/` without the viewer performing filesystem access; README files and other non-element Markdown do not become C4 items
- [ ] #2 For every element, core returns stable ID, kind, readable name, description, containment, direct children, plan identity when applicable, lifecycle origin, and complete component Code references; relationships include source, target, description, and technology
- [ ] #3 Each returned representation has exactly one origin annotation: `observed`, `planned`, or `missing`
- [ ] #4 Core exposes every plan in the same response while keeping its representations and plan identity independent; the MVP does not merge or reconcile overlapping plans
- [ ] #5 Runtime origin annotations are returned to the viewer and are never written to architecture frontmatter or Markdown bodies
- [ ] #6 Scanner plugins still only return scan data to core and have no viewer or Markdown-writing responsibility
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [ ] #1 Acceptance criteria have objective verification evidence.
- [ ] #2 Relevant checks pass and changes remain task-scoped.
- [ ] #3 Public contracts or documentation are updated when behavior changes.
- [ ] #4 Implementation Plan reflects the final approach; correction history and verification are recorded in Implementation Notes.
- [ ] #5 Focused core view-model tests and the project check command pass
- [ ] #6 Public product and viewer contracts describe the implemented core boundary and runtime annotations
- [ ] #7 Fixtures containing observed, missing, at least two independent plans, and architecture README files verify that core loads every C4 element, ignores non-element prose, and preserves plan identity, containment, relationships, readable details, and Code references
- [ ] #8 An I/O boundary test verifies that viewer modules consume the returned model without reading architecture paths
- [ ] #9 A cold simplicity review explains the Markdown-to-core-model flow and removes anything not required by these acceptance criteria
<!-- DOD:END -->
