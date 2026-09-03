---
type: C4 Component
title: Events validator
status: stable
groma:
  id: events-validator
  parent: events
  group: Core
  code:
    - scanner: typescript
      file: src/orders/events/validator.ts
      symbol: validator
    - scanner: typescript
      file: src/orders/events/validator-1.ts
      symbol: validator
    - scanner: typescript
      file: src/orders/events/validator-2.ts
      symbol: validator
    - scanner: typescript
      file: src/orders/events/validator-3.ts
      symbol: validator
    - scanner: typescript
      file: src/orders/events/validator-4.ts
      symbol: validator
---

Events validator of Events.

## Relationships

| Target | Description | Technology |
| --- | --- | --- |
| [events-mapper](events-mapper.md) | Calls mapper | HTTP |
| [events-reader](events-reader.md) | Reads reader | HTTP |
