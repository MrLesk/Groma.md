---
type: C4 Component
title: Cdn Edge validator
status: stable
groma:
  id: cdn-edge-validator
  parent: cdn-edge
  group: Core
  code:
    - scanner: typescript
      file: src/storefront/cdn-edge/validator.ts
      symbol: validator
    - scanner: typescript
      file: src/storefront/cdn-edge/validator-1.ts
      symbol: validator
    - scanner: typescript
      file: src/storefront/cdn-edge/validator-2.ts
      symbol: validator
    - scanner: typescript
      file: src/storefront/cdn-edge/validator-3.ts
      symbol: validator
    - scanner: typescript
      file: src/storefront/cdn-edge/validator-4.ts
      symbol: validator
---

Cdn Edge validator of Cdn Edge.

## Relationships

| Target | Description | Technology |
| --- | --- | --- |
| [cdn-edge-mapper](cdn-edge-mapper.md) | Calls mapper | HTTP |
| [cdn-edge-reader](cdn-edge-reader.md) | Reads reader | HTTP |
