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
      dependencies: 1
      dependents: 3
    - scanner: typescript
      file: src/viewers/web/flow/state.ts
      symbol: toggleFlowActivation
      dependencies: 1
      dependents: 1
    - scanner: typescript
      file: src/viewers/web/flow/reader.ts
      dependencies: 3
      dependents: 1
---

Lists authored architecture scenarios and reads their purpose and ordered steps. It keeps one focused flow and step, highlights only their explicit connections, and preserves that context while endpoints are inspected.

## Relationships

| Target | Description | Technology |
| --- | --- | --- |
| [Viewer semantics](../../view-host/components/viewer-semantics.md) | Reads explicit flow membership and ordered relationship steps | In-process data |
