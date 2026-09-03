---
type: C4 Component
title: Directory gateway
status: stable
groma:
  id: directory-gateway
  parent: directory
  group: Core
  code:
    - scanner: typescript
      file: src/identity/directory/gateway.ts
      symbol: gateway
---

Directory gateway of Directory.

## Relationships

| Target | Description | Technology |
| --- | --- | --- |
| [directory-router](directory-router.md) | Calls router | HTTP |
| [directory-session](directory-session.md) | Reads session | HTTP |
| [sessions-gateway](../../../../identity/containers/sessions/components/sessions-gateway.md) | Forwards requests | HTTP |
