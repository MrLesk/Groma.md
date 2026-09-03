---
type: C4 Component
title: Events logger
status: stable
groma:
  id: events-logger
  parent: events
  code:
    - scanner: typescript
      file: src/orders/events/logger.ts
      symbol: logger
    - scanner: typescript
      file: src/orders/events/logger-1.ts
      symbol: logger
    - scanner: typescript
      file: src/orders/events/logger-2.ts
      symbol: logger
    - scanner: typescript
      file: src/orders/events/logger-3.ts
      symbol: logger
---

Events logger of Events.

## Relationships

| Target | Description | Technology |
| --- | --- | --- |
| [events-client](events-client.md) | Calls client | HTTP |
