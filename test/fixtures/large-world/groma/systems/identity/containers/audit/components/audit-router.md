---
type: C4 Component
title: Audit router
status: stable
groma:
  id: audit-router
  parent: audit
  group: Core
  code:
    - scanner: typescript
      file: src/identity/audit/router.ts
      symbol: router
    - scanner: typescript
      file: src/identity/audit/router-1.ts
      symbol: router
---

Audit router of Audit.

## Relationships

| Target | Description | Technology |
| --- | --- | --- |
| [audit-session](audit-session.md) | Calls session | HTTP |
| [audit-cache](audit-cache.md) | Reads cache | HTTP |
