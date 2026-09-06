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
      symbol: createFlowList
    - scanner: typescript
      file: src/viewers/web/flow/row.ts
    - scanner: typescript
      file: src/viewers/web/flow/state.ts
      symbol: toggleFlowActivation
    - scanner: typescript
      file: src/viewers/web/flow/reader.ts
---

Lists authored architecture scenarios and reads their purpose and ordered steps. It keeps one focused flow and step, highlights only their explicit connections, and preserves that context while endpoints are inspected.
