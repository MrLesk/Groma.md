---
type: C4 Component
title: Create
status: stable
groma:
  id: create
  parent: cli
  group: Architecture authoring
  code:
    - scanner: typescript
      file: src/create.ts
      dependencies: 6
      dependents: 2
    - scanner: typescript
      file: src/naming.ts
      dependencies: 0
      dependents: 5
---

Authors a new planned or observed C4 concept with standard OKF metadata,
nested Groma identity and containment, and body overview prose. Planned writes
are draft; observed writes are stable. `--overview` owns the long body and the
optional `--description` owns only the concise standard field.

## Relationships

| Target | Description | Technology |
| --- | --- | --- |
| [Architecture reader](../../core/components/architecture-reader.md) | Checks the merged world before writing | In-process data |
| [Architecture writer](../../core/components/architecture-writer.md) | Writes the new architecture document | In-process data |
