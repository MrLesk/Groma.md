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
      file: plugins/scanners/angular/src/project.ts
    - scanner: typescript
      file: plugins/scanners/angular/src/evidence.ts
    - scanner: typescript
      file: plugins/scanners/angular/src/template.ts
      symbol: Templates
    - scanner: typescript
      file: plugins/scanners/angular/src/directives.ts
  group: Language analysis
description: Analyses Angular components, templates and HTTP bindings
---

Compiles each Angular project through the TypeScript configs that own its sources, including solution configs and Nx projects, and parses component templates with the Angular template parser. Returns declarations, component source units, output bindings to parent methods, supported HTTP requests and application entries.
