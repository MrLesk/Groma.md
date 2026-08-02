---
id: canvas
kind: component
parent: viewer
---

# Semantic zoom map

Presents context, containers, components, and code in one fixed nested world. Camera zoom
changes the globally visible C4 detail while panning preserves the current level
across the map.

## Interaction

- Wheel zooms continuously.
- Drag pans the map.
- Plus, minus, and the slider control the same camera.
- Named landmarks identify Context, Containers, Components, and Code, and the
  slider carries the four fixed level breakpoints.
- Level boundaries change visibility and emphasis, not geometry.

## Technology

React Flow.
