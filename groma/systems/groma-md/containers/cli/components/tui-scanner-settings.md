---
type: C4 Component
title: Terminal scanner settings
status: stable
groma:
  id: tui-scanner-settings
  parent: cli
  code:
    - scanner: typescript
      file: src/viewers/tui/scanner-settings.ts
  group: Terminal map
---

Shows installed, missing, and recommended scanners. Sends user actions to the shared scanner settings session.
