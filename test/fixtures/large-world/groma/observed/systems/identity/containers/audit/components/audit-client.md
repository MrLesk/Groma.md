---
type: C4 Component
title: Audit client
status: stable
groma:
  id: audit-client
  parent: audit
  code:
    - scanner: typescript
      file: src/identity/audit/client.ts
      symbol: client
    - scanner: typescript
      file: src/identity/audit/client-1.ts
      symbol: client
    - scanner: typescript
      file: src/identity/audit/client-2.ts
      symbol: client
    - scanner: typescript
      file: src/identity/audit/client-3.ts
      symbol: client
    - scanner: typescript
      file: src/identity/audit/client-4.ts
      symbol: client
---

Audit client of Audit.

## Relationships

| Target | Description | Technology |
| --- | --- | --- |
| [system](../../../../payments/system.md) | Charges cards | HTTP |
