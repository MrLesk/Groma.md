---
type: C4 Component
title: Java scanner delivery
status: stable
groma:
  id: scanner-build
  parent: scanner
  code:
    - scanner: typescript
      file: plugins/scanners/java/build.ts
    - scanner: typescript
      file: scripts/smoke-java-scanner.ts
description: Builds and verifies installable Java scanner packages
---

Compiles the worker once for distribution, bundles the scanner module and optionally creates a platform-specific Java runtime image. The isolated-PATH smoke verifies standalone Groma can load the package and reconcile Java evidence without external Java, Node, Bun, Maven or Gradle. No package is published by these commands.
