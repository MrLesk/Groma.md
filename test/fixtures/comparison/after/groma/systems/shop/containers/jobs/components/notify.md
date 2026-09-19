---
type: C4 Component
title: Notifications
status: stable
groma:
  id: notify
  parent: jobs
  code:
    - scanner: typescript
      file: src/notify.ts
    - scanner: typescript
      file: src/screen.ts
---

Sends order confirmations.
