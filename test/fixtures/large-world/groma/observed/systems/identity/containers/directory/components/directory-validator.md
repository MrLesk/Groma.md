---
type: C4 Component
title: Directory validator
status: stable
groma:
  id: directory-validator
  parent: directory
  group: Core
  code:
    - scanner: typescript
      file: src/identity/directory/validator.ts
      symbol: validator
    - scanner: typescript
      file: src/identity/directory/validator-1.ts
      symbol: validator
    - scanner: typescript
      file: src/identity/directory/validator-2.ts
      symbol: validator
    - scanner: typescript
      file: src/identity/directory/validator-3.ts
      symbol: validator
    - scanner: typescript
      file: src/identity/directory/validator-4.ts
      symbol: validator
---

Directory validator of Directory.

## Relationships

| Target | Description | Technology |
| --- | --- | --- |
| [directory-mapper](directory-mapper.md) | Calls mapper | HTTP |
| [directory-reader](directory-reader.md) | Reads reader | HTTP |
