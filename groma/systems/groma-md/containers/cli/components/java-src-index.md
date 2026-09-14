---
type: C4 Component
title: Java scanner adapter
status: stable
groma:
  id: java-src-index
  parent: cli
  code:
    - scanner: typescript
      file: plugins/scanners/java/src/index.ts
    - scanner: typescript
      file: plugins/scanners/java/src/adapter.ts
    - scanner: typescript
      file: plugins/scanners/java/src/maven.ts
    - scanner: typescript
      file: plugins/scanners/java/src/process.ts
  group: Language analysis
---

Selects Maven projects and checks the Java tools. Starts the Java worker with the prepared project model.
