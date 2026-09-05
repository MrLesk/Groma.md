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
      dependencies: 3
      dependents: 2
    - scanner: typescript
      file: src/viewers/web/atoms/chrome.ts
      symbol: chromeCss
      dependencies: 0
      dependents: 1
    - scanner: typescript
      file: src/viewers/web/atoms/button.ts
      symbol: chromeButton
      dependencies: 0
      dependents: 2
    - scanner: typescript
      file: src/viewers/web/chrome/motion.ts
      dependencies: 0
      dependents: 3
    - scanner: typescript
      file: src/viewers/web/chrome/map-debug.ts
      dependencies: 1
      dependents: 2
    - scanner: typescript
      file: src/viewers/web/atoms/theme.ts
      dependencies: 1
      dependents: 3
    - scanner: typescript
      file: src/viewers/web/organisms/sidebar-section.ts
      symbol: sectionHeading
      dependencies: 0
      dependents: 2
    - scanner: typescript
      file: src/viewers/web/organisms/tip.ts
      dependencies: 0
      dependents: 5
    - scanner: typescript
      file: scripts/lint-web-scrollbars.ts
      dependencies: 0
      dependents: 0
    - scanner: typescript
      file: src/viewers/web/chrome/credits.ts
      dependencies: 1
      dependents: 1
    - scanner: typescript
      file: src/viewers/web/atoms/text.ts
      dependencies: 0
      dependents: 2
    - scanner: typescript
      file: src/viewers/web/atoms/escape.ts
      symbol: escaped
      dependencies: 0
      dependents: 3
    - scanner: typescript
      file: src/viewers/web/chrome/shortcuts.ts
      dependencies: 1
      dependents: 1
    - scanner: typescript
      file: src/viewers/web/chrome/theme-control.ts
      dependencies: 3
      dependents: 1
    - scanner: typescript
      file: src/viewers/web/chrome/empty.ts
      dependencies: 4
      dependents: 2
---

Owns the fixed browser chrome, theme choice, keyboard shortcuts, shared controls and reading surfaces around the map. It supplies common text and popup presentation, restrained motion and the initial drafting invitation when the architecture is empty.
