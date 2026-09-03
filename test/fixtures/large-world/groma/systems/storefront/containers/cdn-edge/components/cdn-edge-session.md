---
type: C4 Component
title: Cdn Edge session
status: stable
groma:
  id: cdn-edge-session
  parent: cdn-edge
  group: Core
  code:
    - scanner: typescript
      file: src/storefront/cdn-edge/session.ts
      symbol: session
    - scanner: typescript
      file: src/storefront/cdn-edge/session-1.ts
      symbol: session
    - scanner: typescript
      file: src/storefront/cdn-edge/session-2.ts
      symbol: session
---

Cdn Edge session of Cdn Edge.

## Relationships

| Target | Description | Technology |
| --- | --- | --- |
| [cdn-edge-cache](cdn-edge-cache.md) | Calls cache | HTTP |
| [cdn-edge-validator](cdn-edge-validator.md) | Reads validator | HTTP |
