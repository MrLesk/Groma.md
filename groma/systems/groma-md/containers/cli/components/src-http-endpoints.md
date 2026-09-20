---
type: C4 Component
title: TypeScript HTTP analysis
status: stable
groma:
  id: src-http-endpoints
  parent: cli
  code:
    - scanner: typescript
      file: plugins/scanners/typescript/src/http-endpoints.ts
      symbol: httpEndpoints
    - scanner: typescript
      file: plugins/scanners/typescript/src/http-controllers.ts
      symbol: controllerEndpoints
    - scanner: typescript
      file: plugins/scanners/typescript/src/http-checker.ts
  group: Language analysis
description: Finds TypeScript HTTP clients and endpoints from compiler symbols
---

Uses TypeScript symbols and supported framework registrations to identify HTTP clients and endpoints. Returns request and provider evidence to the TypeScript scanner.
