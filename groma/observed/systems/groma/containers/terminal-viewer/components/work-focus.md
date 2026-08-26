---
id: work-focus
kind: component
parent: terminal-viewer
code:
  - scanner: typescript
    file: src/viewers/tui/work/navigation.ts
    symbol: reduceWorkFocus
    dependencies: 3
    dependents: 1
  - scanner: typescript
    file: src/viewers/tui/work/model.ts
    dependencies: 4
    dependents: 6
  - scanner: typescript
    file: src/viewers/tui/work/paint.ts
    dependencies: 7
    dependents: 2
---

# Work focus

Keeps compact Backlog markers and a map-bottom recap visible, then turns the terminal side panes into a status-grouped task navigator and full task details when the architect presses `w`. A selected task temporarily chooses the smallest map scope that shows all of its touched architecture and frames those targets at the fixed terminal scale. Closing Work restores the prior architecture and flow view.

## Relationships

| Target | Description | Technology |
| --- | --- | --- |
| [Backlog plugin](../../view-host/components/backlog-plugin.md) | Reads the workflow and complete task information | WorkSnapshot |
| [Navigation](navigation.md) | Owns Work focus and its selected task | reduceViewer |
| [Projection](projection.md) | Promotes and frames every visible task anchor | projectWork |
