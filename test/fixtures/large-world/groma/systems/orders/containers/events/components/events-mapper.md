---
type: C4 Component
title: Events mapper
status: stable
groma:
  id: events-mapper
  parent: events
  group: Support
  code:
    - scanner: typescript
      file: src/orders/events/mapper.ts
      symbol: mapper
---

Events mapper of Events.

## Relationships

| Target | Description | Technology |
| --- | --- | --- |
| [events-reader](events-reader.md) | Calls reader | HTTP |
| [events-writer](events-writer.md) | Reads writer | HTTP |
