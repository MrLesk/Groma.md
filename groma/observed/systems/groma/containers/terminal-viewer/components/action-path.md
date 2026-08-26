---
id: action-path
kind: component
parent: terminal-viewer
group: Navigation
code:
  - scanner: typescript
    file: src/viewers/action-path.ts
    symbol: actionCaption
    dependencies: 2
    dependents: 11
---

# Action path

Resolves an actor command into the walk it lights: the legs from the launcher onward, scoped to one actor when picked from their details, and the elements those legs touch. Both viewers share it.
