---
id: render
kind: component
parent: web-viewer
code:
  - scanner: typescript
    file: src/viewers/web/render.ts
---

# Render

Drives the browser: projects the sheet, paints the map, keeps the selection in step with the hierarchy and details panes, lights a picked flow, zooms and pans the camera, and applies every world the server pushes.

## Relationships

| Target | Description | Technology |
| --- | --- | --- |
| [Iso projection](iso-projection.md) | Projects the sheet into screen polygons | In-process data |
| [Iso map](iso-map.md) | Paints and restyles the SVG | DOM |
| [Iso camera](iso-camera.md) | Fits, zooms, and pans | In-process data |
