---
type: C4 Component
title: Cdn Edge cache
status: stable
groma:
  id: cdn-edge-cache
  parent: cdn-edge
  group: Core
  code:
    - scanner: typescript
      file: src/storefront/cdn-edge/cache.ts
      symbol: cache
    - scanner: typescript
      file: src/storefront/cdn-edge/cache-1.ts
      symbol: cache
    - scanner: typescript
      file: src/storefront/cdn-edge/cache-2.ts
      symbol: cache
    - scanner: typescript
      file: src/storefront/cdn-edge/cache-3.ts
      symbol: cache
---

Cdn Edge cache of Cdn Edge.

## Relationships

| Target | Description | Technology |
| --- | --- | --- |
| [cdn-edge-validator](cdn-edge-validator.md) | Calls validator | HTTP |
| [cdn-edge-mapper](cdn-edge-mapper.md) | Reads mapper | HTTP |
