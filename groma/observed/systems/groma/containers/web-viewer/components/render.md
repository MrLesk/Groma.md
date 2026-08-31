---
type: C4 Component
title: Render
status: stable
groma:
  id: render
  parent: web-viewer
  group: Web runtime
  code:
    - scanner: typescript
      file: src/viewers/web/render.ts
      dependencies: 32
      dependents: 0
    - scanner: typescript
      file: src/viewers/web/selection.ts
      dependencies: 0
      dependents: 4
    - scanner: typescript
      file: src/viewers/web/url.ts
      dependencies: 6
      dependents: 1
---

Owns browser selection and orchestration: paints the map, hierarchy and details, applies live payloads, and keeps URL state synchronized without changing sheet geometry.

## Relationships

| Target | Description | Technology |
| --- | --- | --- |
| [Iso camera](iso-camera.md) | Fits, pans, and zooms the map | In-process data |
| [Iso map](iso-map.md) | Paints and restyles the SVG blueprint | DOM |
| [Iso projection](iso-projection.md) | Projects the sheet into screen polygons | In-process data |
| [Project editor](project-editor.md) | Edits the project profile. | HTTP |
| [Source viewer](source-viewer.md) | Opens owned Code without changing architecture selection | Browser state |
