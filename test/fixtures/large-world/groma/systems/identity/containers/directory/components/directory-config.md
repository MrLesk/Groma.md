---
type: C4 Component
title: Directory config
status: stable
groma:
  id: directory-config
  parent: directory
  code:
    - scanner: typescript
      file: src/identity/directory/config.ts
      symbol: config
    - scanner: typescript
      file: src/identity/directory/config-1.ts
      symbol: config
    - scanner: typescript
      file: src/identity/directory/config-2.ts
      symbol: config
---

Directory config of Directory.

## Relationships

| Target | Description | Technology |
| --- | --- | --- |
| [directory-logger](directory-logger.md) | Calls logger | HTTP |
| [directory-client](directory-client.md) | Reads client | HTTP |
