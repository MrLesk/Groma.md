---
type: C4 Component
title: Task panels
status: stable
groma:
  id: island
  parent: export
  code:
    - scanner: typescript
      file: src/viewers/web/work/island.ts
    - scanner: typescript
      file: src/viewers/web/work/component-tasks.ts
    - scanner: typescript
      file: src/viewers/web/work/selection.ts
    - scanner: typescript
      file: src/viewers/web/work/summary.ts
  group: Project work
description: Shows task counts and work lists beside the browser map
---

Shows task counts, lists, and component work. Updates the map when the selected task or status filters change.
