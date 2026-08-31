---
type: C4 Component
title: Component tasks
status: stable
groma:
  id: component-tasks
  parent: web-viewer
  group: Work
  code:
    - scanner: typescript
      file: src/viewers/web/work/component-tasks.ts
      dependencies: 1
      dependents: 2
---

Renders linked task groups and task entry actions inside the shared Web details pane.

## Relationships

| Target | Description | Technology |
| --- | --- | --- |
| [Work projection](../../view-host/components/work-projection.md) | Uses the shared component-to-task grouping | In-process data |
