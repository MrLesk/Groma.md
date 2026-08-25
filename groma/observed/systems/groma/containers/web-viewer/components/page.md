---
id: page
kind: component
parent: web-viewer
code:
  - scanner: typescript
    file: src/viewers/web/page.ts
    symbol: renderPage
---

# Page

Serves the HTML shell: the chrome, the three panes, the embedded project, world and sheet, the palette variables, and the map and project-editor stylesheets.

## Relationships

| Target | Description | Technology |
| --- | --- | --- |
| [Render](render.md) | Loads the browser bundle that drives the map | render.js |
