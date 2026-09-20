---
type: C4 Component
title: Swift scanner adapter
status: stable
groma:
  id: swift-src-index
  parent: cli
  code:
    - scanner: typescript
      file: plugins/scanners/swift/src/index.ts
  group: Language analysis
---

Selects Swift source files and starts the bundled SwiftSyntax worker. Converts its declarations and operation evidence into scan results and source outlines.
