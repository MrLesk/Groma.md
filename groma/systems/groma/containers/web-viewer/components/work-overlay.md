---
type: C4 Component
title: Work overlay
status: stable
groma:
  id: work-overlay
  parent: web-viewer
  group: Work
  code:
    - scanner: typescript
      file: src/viewers/web/work/backlog-mark.ts
    - scanner: typescript
      file: src/viewers/web/work/badge.ts
    - scanner: typescript
      file: src/viewers/web/work/island.ts
    - scanner: typescript
      file: src/viewers/web/atoms/marks.ts
      symbol: MARKS
    - scanner: typescript
      file: src/viewers/web/work/pins.ts
    - scanner: typescript
      file: src/viewers/web/work/selection.ts
      symbol: toggleWorkSelection
    - scanner: typescript
      file: src/viewers/web/work/summary.ts
---

Projects shared task anchors into map pins and the Live work island, with status filtering and task selection separate from architecture selection. Its collapsed badge counts unique mapped tasks in the enabled filters and briefly signals observed task changes and completion; hover explains the status counts and latest change.
