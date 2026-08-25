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

Owns viewer state: root or container scope, selection, the last crossed map edge, the filter, the active flow, and whether details are open. Every key becomes one action reduced over that state. Escape closes details and, from container scope, returns to the root map.
