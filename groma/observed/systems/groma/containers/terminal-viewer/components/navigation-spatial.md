---
id: navigation-spatial
kind: component
parent: terminal-viewer
group: Navigation
code:
  - scanner: typescript
    file: src/viewers/tui/navigation-spatial.ts
    symbol: canEnter
---

# Navigation spatial

Moves selection along visual rows and columns without changing scope. It normalizes left, right, up, and down onto one forward axis, then applies the same rule in every direction. It remembers the previous map edge so crossing a system boundary takes one keypress. Moving inward then chooses the first child edge reached, using the entry ray to break equal-edge ties; moving outward continues to the nearest outside peer. It also defines scope transitions: Enter opens a container, while Backspace or Escape returns to root.
