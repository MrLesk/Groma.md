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
      dependencies: 10
      dependents: 1
  group: Web runtime
---

Builds a complete read-only Web snapshot from the current project, architecture, work, diffs, and owned source, then publishes it as atomic static files. Watch mode replaces that snapshot locally while public browsers read only the static host.

## Relationships

| Target | Description | Technology |
| --- | --- | --- |
| [Page](page.md) | Writes the read-only HTML shell with its embedded snapshot | HTML |
| [Web server](web-server.md) | Reuses current map composition and browser bundling | In-process data |
| [Backlog plugin](../../view-host/components/backlog-plugin.md) | Materializes and watches Backlog work | WorkSource |
| [Work projection](../../view-host/components/work-projection.md) | Maps published tasks to architecture anchors | In-process data |
| [Source viewer](source-viewer.md) | Materializes architecture-owned source and code structure | In-process data |
| [Task diff](task-diff.md) | Materializes task diffs and their live error outcomes | In-process data |
| [Architecture watch](../../view-host/components/architecture-watch.md) | Republishes after architecture Markdown changes | watchArchitecture |
| [Scan lifecycle](../../scanner/components/scan-lifecycle.md) | Republishes after supported source changes | watchScan |
