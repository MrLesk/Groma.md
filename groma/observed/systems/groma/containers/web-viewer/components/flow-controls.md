---
type: C4 Component
title: Flow controls
status: stable
groma:
  id: flow-controls
  parent: web-viewer
  group: Work
  code:
    - scanner: typescript
      file: src/viewers/web/flow/list.ts
      symbol: paintFlows
      dependencies: 4
      dependents: 1
    - scanner: typescript
      file: src/viewers/web/flow/row.ts
      dependencies: 2
      dependents: 3
    - scanner: typescript
      file: src/viewers/web/flow/state.ts
      dependencies: 1
      dependents: 2
---

Shows actor command paths in the hierarchy and details panes and keeps flow activation independent from selection.

## Relationships

| Target | Description | Technology |
| --- | --- | --- |
| [Viewer semantics](../../view-host/components/viewer-semantics.md) | Uses the shared actor command paths | In-process data |
