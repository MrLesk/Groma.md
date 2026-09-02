---
type: C4 Component
title: Directory router
status: stable
groma:
  id: directory-router
  parent: directory
  group: Core
  code:
    - scanner: typescript
      file: src/identity/directory/router.ts
      symbol: router
    - scanner: typescript
      file: src/identity/directory/router-1.ts
      symbol: router
---

Directory router of Directory.

## Relationships

| Target | Description | Technology |
| --- | --- | --- |
| [directory-session](directory-session.md) | Calls session | HTTP |
| [directory-cache](directory-cache.md) | Reads cache | HTTP |
