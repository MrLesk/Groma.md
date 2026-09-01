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
      dependencies: 2
      dependents: 1
    - scanner: typescript
      file: src/welcome/model.ts
      dependencies: 2
      dependents: 2
    - scanner: typescript
      file: src/welcome/view.ts
      dependencies: 2
      dependents: 1
---

Owns the shared terminal welcome shell and its Launcher and Instructions screens. The Launcher presents repository context, executable actions, a fixed bottom row for built-in Backlog and scanner readiness, and a read-only advanced command accordion. Instructions presents the shipped guide table and Markdown content. The controller owns keyboard navigation, paging, return to the Launcher, stable non-interactive text, and dispatches only selected executable actions to Commands.

## Relationships

| Target | Description | Technology |
| --- | --- | --- |
| [Scanner modules](../../scanner/components/scanner-modules.md) | Reads configured readiness without executing scanner code | In-process data |
