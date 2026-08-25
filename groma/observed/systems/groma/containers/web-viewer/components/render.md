---
id: render
kind: component
parent: web-viewer
code:
  - scanner: typescript
    file: src/viewers/web/render.ts
  - scanner: typescript
    file: src/viewers/web/chrome/shell.ts
---

# Render

Drives the browser: projects the project profile and sheet, paints the grid across the screen, opens the profile editor from the title plate, fits the camera between the floating hierarchy and selection-owned details panes, keeps selection in step with both panes without reframing when either closes, lights a picked flow, zooms and pans, and applies every world the server pushes.

## Relationships

| Target | Description | Technology |
| --- | --- | --- |
| [Iso projection](iso-projection.md) | Projects the sheet into screen polygons | In-process data |
| [Iso map](iso-map.md) | Paints and restyles the SVG | DOM |
| [Iso camera](iso-camera.md) | Fits, zooms, and pans | In-process data |
| [Project editor](project-editor.md) | Edits the project name and description | HTTP |
