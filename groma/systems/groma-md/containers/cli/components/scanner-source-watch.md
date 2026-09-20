---
type: C4 Component
title: Source watch
status: stable
groma:
  id: scanner-source-watch
  parent: cli
  code:
    - scanner: typescript
      file: src/scanner/source-watch.ts
      symbol: watchObservations
    - scanner: typescript
      file: src/scanner/watch-patterns.ts
      symbol: compileWatchPatterns
  group: Source scanning
description: Re-runs affected scanners when project source files change
---

Matches file changes to scanner subscriptions. Runs the affected scanners and sends their results to the caller.
