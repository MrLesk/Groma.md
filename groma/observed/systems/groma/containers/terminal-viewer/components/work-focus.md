---
id: work-focus
kind: component
parent: terminal-viewer
code:
  - scanner: typescript
    file: src/viewers/tui/work/model.ts
    dependencies: 4
    dependents: 6
  - scanner: typescript
    file: src/viewers/tui/work/navigation.ts
    symbol: reduceWorkFocus
    dependencies: 3
    dependents: 1
  - scanner: typescript
    file: src/viewers/tui/work/paint.ts
    dependencies: 7
    dependents: 2
---

# Work focus

Keeps compact task markers visible and lets the architect inspect one task and frame its touched architecture without replacing the saved architecture view.

## Relationships

| Target | Description | Technology |
| --- | --- | --- |
| [Backlog plugin](../../view-host/components/backlog-plugin.md) | Reads workflow and complete task information | WorkSnapshot |
| [Navigation](navigation.md) | Temporarily owns task focus inside viewer state | In-process data |
| [Projection](projection.md) | Frames every selected task anchor | In-process data |
