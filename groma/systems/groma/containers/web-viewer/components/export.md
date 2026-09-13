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

Builds a complete read-only Web snapshot from stored architecture, the current project, work read through its plugin, diffs, and owned source. Publishes static files for separate hosting. Source scanning belongs to the scanner adapter.
