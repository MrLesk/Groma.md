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
    - scanner: typescript
      file: src/viewers/web/task-diff/updates.ts
  group: Project work
description: Shows a selected task and the source lines it changed
---

Shows the selected task details and file differences. Opens the affected source lines for review.
