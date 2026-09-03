---
type: C4 Component
title: Cdn Edge config
status: stable
groma:
  id: cdn-edge-config
  parent: cdn-edge
  code:
    - scanner: typescript
      file: src/storefront/cdn-edge/config.ts
      symbol: config
    - scanner: typescript
      file: src/storefront/cdn-edge/config-1.ts
      symbol: config
    - scanner: typescript
      file: src/storefront/cdn-edge/config-2.ts
      symbol: config
---

Cdn Edge config of Cdn Edge.

## Relationships

| Target | Description | Technology |
| --- | --- | --- |
| [cdn-edge-logger](cdn-edge-logger.md) | Calls logger | HTTP |
| [cdn-edge-client](cdn-edge-client.md) | Reads client | HTTP |
