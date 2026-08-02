---
id: level-camera
kind: component
parent: terminal-viewer
---

# Level camera

Fully derived camera state: always at the current level's scale, positioned
by a minimal-reveal policy around the selection. Level scales derive from the
terminal viewport with the production landmark rules, correcting the cell
grid's aspect ratio; level changes tween 750 ms in log-scale space, and the
camera only ever rests at a level.

## Technology

Shared landmark derivation.
