---
type: C4 Component
title: Work focus
status: stable
groma:
  id: work-focus
  parent: terminal-viewer
  code:
    - scanner: typescript
      file: src/viewers/tui/work/model.ts
    - scanner: typescript
      file: src/viewers/tui/work/navigation.ts
      symbol: reduceWorkFocus
    - scanner: typescript
      file: src/viewers/tui/work/rows.ts
      symbol: taskRows
---

Owns terminal task selection, grouped lists, folding, status visibility and checklist progress. Opening a task preserves the architecture view and frames its mapped elements; closing it restores that view.
