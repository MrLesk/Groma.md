---
type: C4 Component
title: Page
status: stable
groma:
  id: page
  parent: web-viewer
  group: Web runtime
  code:
    - scanner: typescript
      file: src/viewers/web/page.ts
      symbol: renderPage
---

Serves the browser HTML shell with the three panes and embedded project, architecture, sheet, palette, and feature styles.
