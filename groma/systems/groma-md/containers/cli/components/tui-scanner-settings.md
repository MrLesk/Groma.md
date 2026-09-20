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
description: Shows scanner status and sends settings actions from the terminal
---

Shows installed, missing, and recommended scanners. Sends user actions to the shared scanner settings session.
