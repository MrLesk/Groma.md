---
type: C4 Component
title: Scanner settings panel
status: stable
groma:
  id: scanners-settings
  parent: export
  code:
    - scanner: typescript
      file: src/viewers/web/scanners/settings.ts
    - scanner: typescript
      file: src/viewers/web/scanners/name.ts
      symbol: scannerName
  group: Browser controls
---

Shows scanner state and error details. Lets the user install, update, remove, or retry a scanner.
