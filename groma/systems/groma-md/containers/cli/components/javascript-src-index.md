---
type: C4 Component
title: JavaScript analysis
status: stable
groma:
  id: javascript-src-index
  parent: cli
  code:
    - scanner: typescript
      file: plugins/scanners/javascript/src/index.ts
    - scanner: typescript
      file: plugins/scanners/javascript/src/declarations.ts
    - scanner: typescript
      file: plugins/scanners/javascript/src/sources.ts
    - scanner: typescript
      file: plugins/scanners/javascript/src/evidence.ts
    - scanner: typescript
      file: plugins/scanners/javascript/src/outline.ts
      symbol: readJavaScriptOutline
    - scanner: typescript
      file: plugins/scanners/javascript/src/http.ts
      symbol: javaScriptHttpFacts
    - scanner: typescript
      file: plugins/scanners/javascript/src/http-requests.ts
      symbol: httpRequest
  group: Language analysis
---

Reads JavaScript source declarations and operation bodies with the TypeScript compiler. Returns source outlines, supported calls and HTTP request and endpoint evidence.
