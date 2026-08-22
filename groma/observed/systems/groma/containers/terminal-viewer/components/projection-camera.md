---
id: projection-camera
kind: component
parent: terminal-viewer
group: Projection
code:
  - scanner: typescript
    file: src/viewers/tui/projection-camera.ts
    symbol: focusElement
---

# Projection camera

Frames the selection: the camera that fits the whole map, the pan that keeps a sibling in view without zooming, and the zoom out when the selection leaves a boundary.
