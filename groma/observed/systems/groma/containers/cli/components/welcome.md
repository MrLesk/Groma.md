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

Owns the shared terminal welcome shell and its Launcher, Advanced commands, and Instructions screens. The Launcher presents repository context, executable actions, nested-page markers, and a fixed bottom row for Backlog and scanner readiness. Advanced commands presents read-only commands and concise descriptions in the shared table layout; complete rows scroll without moving its context, Back row, plugin readiness, or footer. Instructions presents the shipped guide table and Markdown content. The controller owns keyboard navigation, paging, return to the Launcher, stable non-interactive text, and dispatches only selected executable actions to Commands.

## Relationships

| Target | Description | Technology |
| --- | --- | --- |
| [Backlog plugin](../../view-host/components/backlog-plugin.md) | Reads embedded work-source readiness and install guidance | In-process data |
| [Scanner modules](../../scanner/components/scanner-modules.md) | Reads configured readiness without executing scanner code | In-process data |
