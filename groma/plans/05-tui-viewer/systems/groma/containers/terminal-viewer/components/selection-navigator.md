---
id: selection-navigator
kind: component
parent: terminal-viewer
---

# Selection navigator

Owns the whole application state — (level, selection) — and keeps its
invariant: the selection is always a member of the current level's peer set.

## Interaction

- Arrows select the nearest same-level peer in the pressed direction; when
  none lies that way, the selection escapes the boundary to the nearest
  outer-level element that is not an ancestor and the app ascends to its
  level.
- Enter descends to the first child; at the bottom it opens the component
  detail pane.
- Backspace and Esc ascend to the parent; level jumps anchor through the
  ancestor and first-child chains.
- A breadcrumb of the selection path is always visible.

## Technology

OpenTUI keyboard input.

## Relationships

| Target | Description | Technology |
| --- | --- | --- |
| [Web viewer](../../viewer/container.md) | Traverses the same projected geometry and containment | Shared world model |
| [Level camera](level-camera.md) | Derives the camera from level and selection | In-process |
