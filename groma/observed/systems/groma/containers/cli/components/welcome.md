---
type: C4 Component
title: Welcome
status: stable
groma:
  id: welcome
  parent: cli
  group: Command surface
  code:
    - scanner: typescript
      file: src/welcome.ts
      dependencies: 1
      dependents: 1
---

Owns the shared terminal welcome shell and its Launcher and Instructions screens. The Launcher presents executable actions and a read-only advanced command accordion. Instructions presents the shipped guide table and Markdown content. The controller owns keyboard navigation, paging, return to the Launcher, stable non-interactive text, and dispatches only selected executable actions to Commands.
