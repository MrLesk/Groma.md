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

Owns viewer state: root or container scope, architecture selection, the last crossed map edge, the filter, the active flow, Work focus, its selected task, and whether details are open. Every key becomes one action reduced over that state. Work focus temporarily gives the side panes to tasks while preserving architecture and flow state.
