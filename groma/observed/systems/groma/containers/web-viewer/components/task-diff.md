---
id: task-diff
kind: component
parent: web-viewer
group: Web chrome
code:
  - scanner: typescript
    file: src/viewers/web/task-diff/control.ts
    dependencies: 3
    dependents: 1
  - scanner: typescript
    file: src/viewers/web/task-diff/project.ts
    dependencies: 0
    dependents: 2
  - scanner: typescript
    file: src/viewers/web/task-diff/read.ts
    dependencies: 3
    dependents: 3
  - scanner: typescript
    file: src/viewers/web/task-diff/view.ts
    dependencies: 6
    dependents: 2
---

# Task diff

Loads a selected Backlog task's recorded files on demand and shows their Git states and unified diffs inside the details pane. Completed tasks use their exact task commit; active tasks compare HEAD with the working tree and mark files recorded by another active task as shared.

## Relationships

| Target | Description | Technology |
| --- | --- | --- |
| [CLI Git](../../cli/components/cli-git.md) | Resolves exact commits and reads their file versions | Git |
| [Source viewer](source-viewer.md) | Reuses the source syntax highlighter and file-viewer shell | DOM and CSS |
| [Web server](web-server.md) | Loads task diffs only after a task is selected | JSON |
