---
type: C4 Component
title: Static export
status: stable
groma:
  id: web-export
  parent: cli
  code:
    - scanner: typescript
      file: src/viewers/web/export.ts
  group: Browser delivery
---

Writes a browser map with saved architecture, task details, and source text. The exported page reads this saved data without a Groma server.
