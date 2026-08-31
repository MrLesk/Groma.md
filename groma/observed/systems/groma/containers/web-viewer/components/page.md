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
      dependencies: 22
      dependents: 2
---

Serves the browser HTML shell with the three panes and embedded project, architecture, sheet, palette, and feature styles.

## Relationships

| Target | Description | Technology |
| --- | --- | --- |
| [Render](render.md) | Loads the browser runtime | Browser module |
