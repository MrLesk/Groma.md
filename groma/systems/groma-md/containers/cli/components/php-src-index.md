---
type: C4 Component
title: PHP analysis
status: stable
groma:
  id: php-src-index
  parent: cli
  code:
    - scanner: typescript
      file: plugins/scanners/php/src/index.ts
    - scanner: typescript
      file: plugins/scanners/php/src/evidence.ts
      symbol: phpEvidence
    - scanner: typescript
      file: plugins/scanners/php/src/syntax.ts
    - scanner: typescript
      file: plugins/scanners/php/src/tokens.ts
      symbol: operationTokens
    - scanner: typescript
      file: plugins/scanners/php/src/outline.ts
      symbol: readCodeStructure
    - scanner: typescript
      file: plugins/scanners/php/src/http.ts
    - scanner: typescript
      file: plugins/scanners/php/src/http-clients.ts
    - scanner: typescript
      file: plugins/scanners/php/src/http-curl.ts
      symbol: curlRequests
    - scanner: typescript
      file: plugins/scanners/php/src/http-endpoints.ts
    - scanner: typescript
      file: plugins/scanners/php/src/http-laravel.ts
    - scanner: typescript
      file: plugins/scanners/php/src/http-url.ts
    - scanner: typescript
      file: plugins/scanners/php/src/receivers.ts
    - scanner: typescript
      file: plugins/scanners/php/src/http-routes.ts
  group: Language analysis
---

Parses PHP source declarations and operation bodies. Returns source outlines, supported calls and HTTP request and endpoint evidence.
