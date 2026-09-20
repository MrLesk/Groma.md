---
type: C4 Component
title: Vue analysis
status: stable
groma:
  id: vue-src-index
  parent: cli
  code:
    - scanner: typescript
      file: plugins/scanners/vue/src/index.ts
      symbol: scanVue
    - scanner: typescript
      file: plugins/scanners/vue/src/project.ts
    - scanner: typescript
      file: plugins/scanners/vue/src/evidence.ts
      symbol: VueEvidence
    - scanner: typescript
      file: plugins/scanners/vue/src/http.ts
    - scanner: typescript
      file: plugins/scanners/vue/src/server-routes.ts
      symbol: serverRoute
    - scanner: typescript
      file: plugins/scanners/vue/src/outline.ts
      symbol: readVueOutline
    - scanner: typescript
      file: plugins/scanners/vue/src/operations.ts
      symbol: addComparedOperations
    - scanner: typescript
      file: plugins/scanners/vue/src/sfc.ts
  group: Language analysis
---

Reads Vue source and templates. Returns declarations, event callback evidence, operation bodies, source outlines and supported HTTP requests and endpoints.
