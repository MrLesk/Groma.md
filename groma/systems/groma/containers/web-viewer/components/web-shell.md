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
      dependencies: 1
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
      dependents: 2
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
      dependents: 4
    - scanner: typescript
      file: scripts/lint-web-scrollbars.ts
      dependencies: 0
      dependents: 0
    - scanner: typescript
      file: src/viewers/web/chrome/credits.ts
      dependencies: 1
      dependents: 1
---

Owns the fixed browser chrome, theme, restrained motion, common controls, scroll surfaces, help tips, and optional map diagnostics.
