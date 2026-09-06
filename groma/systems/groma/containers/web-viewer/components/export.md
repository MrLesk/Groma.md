---
type: C4 Component
title: Export
status: stable
groma:
  id: export
  parent: web-viewer
  code:
    - scanner: typescript
      file: src/viewers/web/export.ts
  group: Web runtime
---

Builds a complete read-only Web snapshot from the current project, architecture, work, diffs, and owned source, then publishes it as atomic static files. Watch mode replaces that snapshot locally while public browsers read only the static host.
