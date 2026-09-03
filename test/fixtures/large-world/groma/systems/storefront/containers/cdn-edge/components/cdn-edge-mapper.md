---
type: C4 Component
title: Cdn Edge mapper
status: stable
groma:
  id: cdn-edge-mapper
  parent: cdn-edge
  group: Support
  code:
    - scanner: typescript
      file: src/storefront/cdn-edge/mapper.ts
      symbol: mapper
---

Cdn Edge mapper of Cdn Edge.

## Relationships

| Target | Description | Technology |
| --- | --- | --- |
| [cdn-edge-reader](cdn-edge-reader.md) | Calls reader | HTTP |
| [cdn-edge-writer](cdn-edge-writer.md) | Reads writer | HTTP |
