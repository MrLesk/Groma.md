---
id: terminal-canvas
kind: component
parent: tui
---

# Terminal canvas

Paints the fixed world into character cells. Every element renders at the
representation-ladder rung its cell budget affords — glyph, block, titled box,
full card — floored at the titled box when the element's own C4 level is
current. Emphasis follows the shared crossfade weights as discrete attribute
tiers, and every color is the terminal theme's own.

## Interaction

- Level emphasis steps through bold, normal, dim, and hidden tiers.
- Relationship routes are orthogonal box-drawing lines whose label chips
  avoid occluding cards, sub-labels, and each other.
- The focal system's Context identity is its emphasized folio header, never
  ASCII art.

## Technology

OpenTUI frame buffer.

## Relationships

| Target | Description | Technology |
| --- | --- | --- |
| [Viewer](../../viewer/container.md) | Renders the same projected fixed world | Shared world model |
| [Level camera](level-camera.md) | Reads the derived camera each frame | In-process |
