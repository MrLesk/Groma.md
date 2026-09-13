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
---

Builds the browser script and the initial page. Loads the architecture model and map layout for delivery.
