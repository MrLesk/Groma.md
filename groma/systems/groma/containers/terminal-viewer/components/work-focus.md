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
      dependencies: 4
      dependents: 8
    - scanner: typescript
      file: src/viewers/tui/work/navigation.ts
      symbol: reduceWorkFocus
      dependencies: 3
      dependents: 1
    - scanner: typescript
      file: src/viewers/tui/work/paint.ts
      symbol: drawWorkMarker
      dependencies: 4
      dependents: 1
---

Keeps compact task markers visible and lets the architect inspect one task and frame its touched architecture without replacing the saved architecture view.

## Relationships

| Target | Description | Technology |
| --- | --- | --- |
| [Backlog plugin](../../view-host/components/backlog-plugin.md) | Reads workflow and complete task information | WorkSnapshot |
| [Navigation](navigation.md) | Temporarily owns task focus inside viewer state | In-process data |
| [Projection](projection.md) | Frames every selected task anchor | In-process data |
