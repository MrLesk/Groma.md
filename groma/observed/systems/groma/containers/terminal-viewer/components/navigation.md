---
id: navigation
kind: component
parent: terminal-viewer
group: Navigation
code:
  - scanner: typescript
    file: src/viewers/tui/navigation.ts
    symbol: defaultSelection
---

# Navigation

Owns viewer state: C4 level, selection, focus, the filter, the lit command, and which panes are open. Every key becomes one action reduced over that state.
