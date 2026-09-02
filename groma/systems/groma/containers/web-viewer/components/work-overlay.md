---
type: C4 Component
title: Work overlay
status: stable
groma:
  id: work-overlay
  parent: web-viewer
  group: Work
  code:
    - scanner: typescript
      file: src/viewers/web/work/backlog-mark.ts
      dependencies: 0
      dependents: 3
    - scanner: typescript
      file: src/viewers/web/work/badge.ts
      dependencies: 3
      dependents: 3
    - scanner: typescript
      file: src/viewers/web/work/island.ts
      dependencies: 5
      dependents: 2
    - scanner: typescript
      file: src/viewers/web/atoms/marks.ts
      symbol: MARKS
      dependencies: 0
      dependents: 1
    - scanner: typescript
      file: src/viewers/web/work/pins.ts
      dependencies: 5
      dependents: 2
    - scanner: typescript
      file: src/viewers/web/work/selection.ts
      symbol: toggleWorkSelection
      dependencies: 0
      dependents: 1
    - scanner: typescript
      file: src/viewers/web/work/status-filter.ts
      dependencies: 0
      dependents: 1
---

Projects shared task anchors into map pins and the Live work island, with status filtering and task selection separate from architecture selection.

## Relationships

| Target | Description | Technology |
| --- | --- | --- |
| [Work projection](../../view-host/components/work-projection.md) | Uses the shared task anchors | In-process data |
