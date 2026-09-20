---
type: C4 Component
title: Scanner discovery
status: stable
groma:
  id: modules-discovery
  parent: cli
  code:
    - scanner: typescript
      file: src/scanner/modules/discovery.ts
    - scanner: typescript
      file: src/scanner/modules/discovery-rules.ts
      symbol: discoveryRuleFindings
    - scanner: typescript
      file: src/scanner/modules/catalog.ts
    - scanner: typescript
      file: src/scanner/modules/official-catalog.ts
  group: Scanner management
description: Recommends scanners that match the technologies in a project
---

Reads project declarations and plugin metadata. Recommends scanners that match the project technologies.
