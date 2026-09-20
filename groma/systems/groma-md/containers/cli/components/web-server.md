---
type: C4 Component
title: Web host
status: stable
groma:
  id: web-server
  parent: cli
  code:
    - scanner: typescript
      file: src/viewers/web/server.ts
      symbol: startWebViewer
    - scanner: typescript
      file: src/viewers/web/map-session.ts
      symbol: createWebMapSession
    - scanner: typescript
      file: src/viewers/web/startup/page.ts
      symbol: renderSetupPage
    - scanner: typescript
      file: src/viewers/web/startup/scanners.ts
  group: Browser delivery
---

Starts the local HTTP server. Serves project setup and connects the browser to architecture, scanner, task, and source operations.
