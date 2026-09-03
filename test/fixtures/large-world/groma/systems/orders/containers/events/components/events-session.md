---
type: C4 Component
title: Events session
status: stable
groma:
  id: events-session
  parent: events
  group: Core
  code:
    - scanner: typescript
      file: src/orders/events/session.ts
      symbol: session
    - scanner: typescript
      file: src/orders/events/session-1.ts
      symbol: session
    - scanner: typescript
      file: src/orders/events/session-2.ts
      symbol: session
---

Events session of Events.

## Relationships

| Target | Description | Technology |
| --- | --- | --- |
| [events-cache](events-cache.md) | Calls cache | HTTP |
| [events-validator](events-validator.md) | Reads validator | HTTP |
