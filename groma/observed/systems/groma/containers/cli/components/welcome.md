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

Owns the bare Groma repository welcome, executable action order, the read-only advanced command accordion, stable non-interactive text, and the keyboard launcher that returns one selected action to Commands.
