---
type: C4 Component
title: Scanner package build
status: stable
groma:
  id: framework-package
  parent: cli
  code:
    - scanner: typescript
      file: plugins/scanners/framework-package.ts
      symbol: buildFrameworkPackage
    - scanner: typescript
      file: plugins/scanners/angular/build.ts
      symbol: buildPackage
    - scanner: typescript
      file: plugins/scanners/react/build.ts
      symbol: buildPackage
    - scanner: typescript
      file: plugins/scanners/vue/build.ts
      symbol: buildPackage
    - scanner: typescript
      file: plugins/scanners/typescript/build.ts
      symbol: buildPackage
    - scanner: typescript
      file: plugins/scanners/go/build.ts
    - scanner: typescript
      file: plugins/scanners/java/build.ts
    - scanner: typescript
      file: plugins/scanners/rust/build.ts
    - scanner: typescript
      file: plugins/scanners/rust/notices.ts
      symbol: writeNotices
  group: Scanner plugins
---

Builds the official scanner packages and native workers. Includes the required compiler files and license notices for distribution.
