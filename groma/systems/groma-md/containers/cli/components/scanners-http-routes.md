---
type: C4 Component
title: HTTP source analysis
status: stable
groma:
  id: scanners-http-routes
  parent: cli
  code:
    - scanner: typescript
      file: plugins/scanners/http-routes.ts
    - scanner: typescript
      file: plugins/scanners/http-bindings.ts
    - scanner: typescript
      file: plugins/scanners/http-order.ts
    - scanner: typescript
      file: plugins/scanners/http-routers.ts
    - scanner: typescript
      file: plugins/scanners/http-syntax.ts
    - scanner: typescript
      file: plugins/scanners/http-uses.ts
    - scanner: typescript
      file: plugins/scanners/http-checker.ts
    - scanner: typescript
      file: plugins/scanners/http-clients.ts
    - scanner: typescript
      file: plugins/scanners/http-paths.ts
    - scanner: typescript
      file: plugins/scanners/http-url.ts
    - scanner: typescript
      file: plugins/scanners/http-values.ts
  group: Scanner support
description: Resolves HTTP clients, routers and endpoints for TypeScript-based scanners
---

Resolves HTTP client values, router registrations and endpoint paths for TypeScript-based scanners. Returns source evidence for Groma to match requests with their providers.
