---
type: C4 Component
title: Flow reader
status: stable
groma:
  id: list
  parent: export
  code:
    - scanner: typescript
      file: src/viewers/web/flow/list.ts
      symbol: createFlowList
    - scanner: typescript
      file: src/viewers/web/flow/reader.ts
    - scanner: typescript
      file: src/viewers/web/flow/row.ts
    - scanner: typescript
      file: src/viewers/web/flow/state.ts
  group: Architecture panels
---

Lists the authored flows and their ordered steps. Highlights the selected flow and returns to the previous map selection.
