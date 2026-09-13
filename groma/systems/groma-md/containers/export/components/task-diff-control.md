---
type: C4 Component
title: Task changes panel
status: stable
groma:
  id: task-diff-control
  parent: export
  code:
    - scanner: typescript
      file: src/viewers/web/task-diff/control.ts
    - scanner: typescript
      file: src/viewers/web/task-diff/view.ts
  group: Project work
---

Shows the selected task details and file differences. Opens the affected source lines for review.
