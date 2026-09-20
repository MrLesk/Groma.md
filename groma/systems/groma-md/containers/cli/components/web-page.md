---
type: C4 Component
title: Web page builder
status: stable
groma:
  id: web-page
  parent: cli
  code:
    - scanner: typescript
      file: src/viewers/web/page.ts
      symbol: renderPage
    - scanner: typescript
      file: src/viewers/web/runtime.ts
    - scanner: typescript
      file: src/viewers/web/payload.ts
  group: Browser delivery
description: Builds the browser page, script and initial architecture payload
---

Builds the browser script and the initial page. Loads the architecture model and map layout for delivery.
