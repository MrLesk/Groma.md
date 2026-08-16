---
id: scan-reconciler
kind: component
parent: core
code:
  - scanner: typescript
    file: src/scan-reconciler.ts
    symbol: foldScanResult
---

# Scan reconciler

Matches scanner results to elements that already exist, refreshes only Code frontmatter after curation, attaches Code to a matching ghost without accepting it, and assigns a readable ID only to a new observation that is not already in the world.
