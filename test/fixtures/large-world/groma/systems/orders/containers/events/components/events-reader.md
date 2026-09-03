---
type: C4 Component
title: Events reader
status: stable
groma:
  id: events-reader
  parent: events
  group: Support
  code:
    - scanner: typescript
      file: src/orders/events/reader.ts
      symbol: reader
    - scanner: typescript
      file: src/orders/events/reader-1.ts
      symbol: reader
---

Events reader of Events.

## Relationships

| Target | Description | Technology |
| --- | --- | --- |
| [events-writer](events-writer.md) | Calls writer | HTTP |
| [events-queue](events-queue.md) | Reads queue | HTTP |
