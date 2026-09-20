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
      file: plugins/scanners/java/src/process.ts
    - scanner: typescript
      file: plugins/scanners/java/src/java-input.ts
    - scanner: typescript
      file: plugins/scanners/java/src/maven.ts
    - scanner: typescript
      file: plugins/scanners/java/src/gradle.ts
    - scanner: typescript
      file: plugins/scanners/java/src/missing-types.ts
      symbol: summarizeMissingTypes
  group: Language analysis
---

Reads supported Maven and Gradle source declarations and prepares the project input. Starts the bundled Java worker and returns its source analysis and outlines.
