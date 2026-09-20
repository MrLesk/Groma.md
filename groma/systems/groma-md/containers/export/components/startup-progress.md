---
type: C4 Component
title: Startup progress
status: stable
groma:
  id: startup-progress
  parent: export
  code:
    - scanner: typescript
      file: src/viewers/web/startup/progress.ts
  group: Browser session
description: Reports browser startup phases while the map is preparing
---

Streams named startup phases to the open page so the host can show progress from project creation through the first painted map.
