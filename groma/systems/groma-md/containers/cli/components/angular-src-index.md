---
type: C4 Component
title: Angular analysis
status: stable
groma:
  id: angular-src-index
  parent: cli
  code:
    - scanner: typescript
      file: plugins/scanners/angular/src/index.ts
    - scanner: typescript
      file: plugins/scanners/angular/src/scan.ts
    - scanner: typescript
      file: plugins/scanners/angular/src/http.ts
      symbol: angularHttpRequests
    - scanner: typescript
      file: plugins/scanners/angular/src/components.ts
  group: Language analysis
description: Analyses Angular components, templates and HTTP bindings
---

Checks Angular source and templates with the Angular compiler. Returns declarations, template callback evidence and supported HTTP requests and endpoints.
