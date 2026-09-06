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
    - scanner: typescript
      file: src/welcome/model.ts
    - scanner: typescript
      file: src/welcome/view.ts
---

Owns the shared terminal welcome shell and its Launcher, Advanced commands, and Instructions screens. The Launcher presents repository context, executable actions, nested-page markers, and a fixed bottom row for Backlog and scanner readiness. Advanced commands presents selectable, read-only command references in the shared table layout and shows the selected command's explanation below it. The command viewport follows Up and Down selection while J/K and page keys scroll only the explanation; context, Back row, plugin readiness, and footer stay fixed. Instructions presents the shipped guide table and Markdown content with the same selection-and-content pattern. The controller owns keyboard navigation, paging, return to the Launcher, stable non-interactive text, and dispatches only selected executable actions to Commands.
