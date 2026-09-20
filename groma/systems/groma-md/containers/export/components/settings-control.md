---
type: C4 Component
title: Display settings
status: stable
groma:
  id: settings-control
  parent: export
  code:
    - scanner: typescript
      file: src/viewers/web/settings/control.ts
    - scanner: typescript
      file: src/viewers/web/settings/model.ts
      symbol: scannerWarning
    - scanner: typescript
      file: src/viewers/web/chrome/theme-control.ts
    - scanner: typescript
      file: src/viewers/web/atoms/theme.ts
    - scanner: typescript
      file: src/viewers/web/chrome/motion.ts
  group: Browser controls
description: Theme, settings menu and plugin attention in the browser
---

Shows the Settings menu and theme choices. Opens plugin settings and points to scanners that need attention. Supplies animations for shared controls.
