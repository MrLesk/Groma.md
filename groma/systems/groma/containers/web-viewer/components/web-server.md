---
type: C4 Component
title: Web server
status: stable
groma:
  id: web-server
  parent: web-viewer
  group: Web runtime
  code:
    - scanner: typescript
      file: src/viewers/web/server.ts
      symbol: startWebViewer
    - scanner: typescript
      file: src/viewers/web/payload.ts
    - scanner: typescript
      file: src/viewers/web/runtime.ts
    - scanner: typescript
      file: src/viewers/web/map-session.ts
      symbol: createWebMapSession
    - scanner: typescript
      file: src/viewers/web/startup/page.ts
      symbol: renderSetupPage
---

Owns the local browser startup flow and ready map session. Missing initialization records open a setup form that uses the shared project initialization operation and runs the first scan. Startup failures show the reported issue in the browser. Once ready, it serves the page and browser bundle from cached project, architecture, sheet and task snapshots. It dispatches architecture writes through the shared authoring operations, handles project edits and on-demand source, diff and revision reads, and publishes live updates.
