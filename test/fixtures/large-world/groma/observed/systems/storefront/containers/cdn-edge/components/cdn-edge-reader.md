---
type: C4 Component
title: Cdn Edge reader
status: stable
groma:
  id: cdn-edge-reader
  parent: cdn-edge
  group: Support
  code:
    - scanner: typescript
      file: src/storefront/cdn-edge/reader.ts
      symbol: reader
    - scanner: typescript
      file: src/storefront/cdn-edge/reader-1.ts
      symbol: reader
---

Cdn Edge reader of Cdn Edge.

## Relationships

| Target | Description | Technology |
| --- | --- | --- |
| [cdn-edge-writer](cdn-edge-writer.md) | Calls writer | HTTP |
| [cdn-edge-queue](cdn-edge-queue.md) | Reads queue | HTTP |
