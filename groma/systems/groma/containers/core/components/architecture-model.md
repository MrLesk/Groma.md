---
type: C4 Component
title: Architecture model
status: stable
groma:
  id: architecture-model
  parent: core
  group: Architecture world
  code:
    - scanner: typescript
      file: src/architecture-model.ts
    - scanner: typescript
      file: src/types.ts
    - scanner: typescript
      file: src/element-order.ts
      symbol: compareSemanticElements
    - scanner: typescript
      file: scripts/validate-architecture.ts
    - scanner: typescript
      file: src/architecture-markdown.ts
    - scanner: typescript
      file: src/code-reference.ts
      symbol: codeReferencesOf
    - scanner: typescript
      file: src/okf-profile.ts
    - scanner: typescript
      file: src/flow-model.ts
      symbol: resolveFlows
---

Turns C4 concepts into a validated semantic graph. It resolves identity, containment, Code ownership and directed relationships from the OKF profile. Current and draft relationship tables define independent link lifecycle; endpoint status does not decide it. Groma Flow records contribute ordered scenario steps that resolve existing relationships without creating elements or routes.
