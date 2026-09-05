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
      dependencies: 6
      dependents: 9
    - scanner: typescript
      file: src/viewers/tui/work/navigation.ts
      symbol: reduceWorkFocus
      dependencies: 4
      dependents: 1
    - scanner: typescript
      file: src/viewers/tui/work/rows.ts
      symbol: taskRows
      dependencies: 3
      dependents: 1
---

Owns terminal task selection, grouped lists, folding, status visibility and checklist progress. Opening a task preserves the architecture view and frames its mapped elements; closing it restores that view.

## Relationships

| Target | Description | Technology |
| --- | --- | --- |
| [Backlog plugin](../../view-host/components/backlog-plugin.md) | Reads workflow and complete task information | WorkSnapshot |
| [Navigation](navigation.md) | Temporarily owns task focus inside viewer state | In-process data |
| [Projection](projection.md) | Frames every selected task anchor | In-process data |
