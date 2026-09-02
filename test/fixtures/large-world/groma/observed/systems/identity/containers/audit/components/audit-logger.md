---
type: C4 Component
title: Audit logger
status: stable
groma:
  id: audit-logger
  parent: audit
  code:
    - scanner: typescript
      file: src/identity/audit/logger.ts
      symbol: logger
    - scanner: typescript
      file: src/identity/audit/logger-1.ts
      symbol: logger
    - scanner: typescript
      file: src/identity/audit/logger-2.ts
      symbol: logger
    - scanner: typescript
      file: src/identity/audit/logger-3.ts
      symbol: logger
---

Audit logger of Audit.

## Relationships

| Target | Description | Technology |
| --- | --- | --- |
| [audit-client](audit-client.md) | Calls client | HTTP |
