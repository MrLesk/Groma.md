---
type: C4 Component
title: Scan lifecycle
status: stable
groma:
  id: scan-lifecycle
  parent: scanner
  group: Scan lifecycle
  code:
    - scanner: typescript
      file: src/scanner.ts
    - scanner: typescript
      file: src/scanner/registry.ts
    - scanner: typescript
      file: src/scan-reconciler.ts
---

Preflights every enabled scanner from one explicit registry, runs one complete
multi-language scan or watched rescan, then reconciles the full evidence batch
with stable authored ownership. A new observed C4 concept
uses the OKF profile with stable status and may have an empty body overview;
refresh and ghost matching update only nested Code evidence and lifecycle
status before writing Markdown.
