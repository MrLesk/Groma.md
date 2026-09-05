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
      dependencies: 6
      dependents: 12
    - scanner: typescript
      file: src/types.ts
      dependencies: 0
      dependents: 92
    - scanner: typescript
      file: src/element-order.ts
      symbol: compareSemanticElements
      dependencies: 1
      dependents: 5
    - scanner: typescript
      file: scripts/validate-architecture.ts
      dependencies: 4
      dependents: 0
    - scanner: typescript
      file: src/architecture-markdown.ts
      dependencies: 1
      dependents: 2
    - scanner: typescript
      file: src/code-reference.ts
      symbol: codeReferencesOf
      dependencies: 1
      dependents: 1
    - scanner: typescript
      file: src/okf-profile.ts
      dependencies: 1
      dependents: 10
    - scanner: typescript
      file: src/flow-model.ts
      symbol: resolveFlows
      dependencies: 4
      dependents: 3
---

Turns C4 concepts into a validated semantic graph. It resolves identity, containment, Code ownership and directed relationships from the OKF profile. Current and draft relationship tables define independent link lifecycle; endpoint status does not decide it. Groma Flow records contribute ordered scenario steps that resolve existing relationships without creating elements or routes.
