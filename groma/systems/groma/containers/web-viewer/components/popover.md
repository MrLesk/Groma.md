---
type: C4 Component
title: Popover
status: stable
groma:
  id: popover
  parent: web-viewer
  group: Web chrome
  code:
    - scanner: typescript
      file: src/viewers/web/atoms/popover.ts
      symbol: anchoredPopoverCss
---

Owns the shared anchored popup surface, option states and outside-pointer dismissal for Web header controls. Native details popups use the default close action; Search supplies cancellation, and Revision includes its tooltip as an owned surface.
