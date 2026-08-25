---
id: projection-camera
kind: component
parent: terminal-viewer
group: Projection
code:
  - scanner: typescript
    file: src/viewers/tui/projection-camera.ts
    symbol: reveal
---

# Projection camera

Centers the initial root or container scope at one readable scale. Selection pans the viewport only far enough to keep the selected peer visible; it never changes the scale or world geometry.
