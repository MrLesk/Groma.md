---
type: C4 Component
title: Events router
status: stable
groma:
  id: events-router
  parent: events
  group: Core
  code:
    - scanner: typescript
      file: src/orders/events/router.ts
      symbol: router
    - scanner: typescript
      file: src/orders/events/router-1.ts
      symbol: router
---

Events router of Events.

## Relationships

| Target | Description | Technology |
| --- | --- | --- |
| [events-session](events-session.md) | Calls session | HTTP |
| [events-cache](events-cache.md) | Reads cache | HTTP |
