---
type: C4 Component
title: React analysis
status: stable
groma:
  id: react-src-index
  parent: cli
  code:
    - scanner: typescript
      file: plugins/scanners/react/src/index.ts
    - scanner: typescript
      file: plugins/scanners/react/src/scan.ts
    - scanner: typescript
      file: plugins/scanners/react/src/functions.ts
    - scanner: typescript
      file: plugins/scanners/react/src/http.ts
      symbol: reactHttpRequests
    - scanner: typescript
      file: plugins/scanners/react/src/routes.ts
  group: Language analysis
---

Reads React source and JSX with the TypeScript compiler. Returns declarations, callback evidence and supported HTTP requests and route providers.
