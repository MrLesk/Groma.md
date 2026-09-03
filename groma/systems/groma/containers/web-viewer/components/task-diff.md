---
type: C4 Component
title: Task diff
status: stable
groma:
  id: task-diff
  parent: web-viewer
  group: Work
  code:
    - scanner: typescript
      file: src/viewers/web/task-diff/control.ts
      dependencies: 3
      dependents: 1
    - scanner: typescript
      file: src/viewers/web/task-diff/view.ts
      dependencies: 6
      dependents: 2
---

Loads a selected Backlog task recorded files and Git states on demand and shows their unified diffs inside Details.

## Relationships

| Target | Description | Technology |
| --- | --- | --- |
| [Revision history](revision-history.md) | Reads exact task commits and file versions | Git |
| [Source viewer](source-viewer.md) | Reuses source highlighting and drill-down | DOM and CSS |
| [Web server](web-server.md) | Loads task diffs only after selection | JSON |
