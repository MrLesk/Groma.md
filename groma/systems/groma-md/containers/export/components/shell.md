---
type: C4 Component
title: Map controls
status: stable
groma:
  id: shell
  parent: export
  code:
    - scanner: typescript
      file: src/viewers/web/chrome/shell.ts
    - scanner: typescript
      file: src/viewers/web/chrome/shortcuts.ts
    - scanner: typescript
      file: src/viewers/web/chrome/stats.ts
    - scanner: typescript
      file: src/viewers/web/chrome/empty.ts
    - scanner: typescript
      file: src/viewers/web/chrome/map-view.ts
    - scanner: typescript
      file: src/viewers/web/chrome/credits.ts
    - scanner: typescript
      file: src/viewers/web/chrome/frame.ts
  group: Browser controls
description: Browser toolbar, side panels and keyboard shortcuts
---

Shows the map toolbar and side panels. Handles keyboard shortcuts, panel expansion and empty map states, and measures the frame the visible chrome leaves for the camera.
