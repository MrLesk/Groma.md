---
type: C4 Component
title: Import validator
status: stable
groma:
  id: import-validator
  parent: import
  group: Core
  code:
    - scanner: typescript
      file: src/catalog/import/validator.ts
      symbol: validator
    - scanner: typescript
      file: src/catalog/import/validator-1.ts
      symbol: validator
    - scanner: typescript
      file: src/catalog/import/validator-2.ts
      symbol: validator
    - scanner: typescript
      file: src/catalog/import/validator-3.ts
      symbol: validator
    - scanner: typescript
      file: src/catalog/import/validator-4.ts
      symbol: validator
---

Import validator of Import.

## Relationships

| Target | Description | Technology |
| --- | --- | --- |
| [import-mapper](import-mapper.md) | Calls mapper | HTTP |
| [import-reader](import-reader.md) | Reads reader | HTTP |
