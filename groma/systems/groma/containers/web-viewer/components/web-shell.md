---
type: C4 Component
title: Web shell
status: stable
groma:
  id: web-shell
  parent: web-viewer
  group: Web chrome
  code:
    - scanner: typescript
      file: src/viewers/web/chrome/shell.ts
    - scanner: typescript
      file: src/viewers/web/atoms/chrome.ts
      symbol: chromeCss
    - scanner: typescript
      file: src/viewers/web/atoms/button.ts
      symbol: chromeButton
    - scanner: typescript
      file: src/viewers/web/chrome/motion.ts
    - scanner: typescript
      file: src/viewers/web/chrome/map-debug.ts
    - scanner: typescript
      file: src/viewers/web/atoms/theme.ts
    - scanner: typescript
      file: src/viewers/web/organisms/sidebar-section.ts
      symbol: sectionHeading
    - scanner: typescript
      file: src/viewers/web/organisms/tip.ts
    - scanner: typescript
      file: scripts/lint-web-scrollbars.ts
    - scanner: typescript
      file: src/viewers/web/chrome/credits.ts
    - scanner: typescript
      file: src/viewers/web/atoms/text.ts
    - scanner: typescript
      file: src/viewers/web/atoms/escape.ts
      symbol: escaped
    - scanner: typescript
      file: src/viewers/web/chrome/shortcuts.ts
    - scanner: typescript
      file: src/viewers/web/chrome/theme-control.ts
    - scanner: typescript
      file: src/viewers/web/chrome/empty.ts
    - scanner: typescript
      file: src/viewers/web/organisms/sidebar-row.ts
      symbol: sidebarRow
---

Owns the fixed browser chrome, theme choice, keyboard shortcuts, shared controls and reading surfaces around the map. It supplies common text and popup presentation, restrained motion and the initial drafting invitation when the architecture is empty.
