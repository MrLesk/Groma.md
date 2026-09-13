---
type: C4 Component
title: Terminal task reader
status: stable
groma:
  id: work-model
  parent: cli
  code:
    - scanner: typescript
      file: src/viewers/tui/work/model.ts
    - scanner: typescript
      file: src/viewers/tui/work/navigation.ts
    - scanner: typescript
      file: src/viewers/tui/work/rows.ts
      symbol: taskRows
  group: Terminal map
---

Shows tasks by status and component. Handles task selection and task list navigation.
