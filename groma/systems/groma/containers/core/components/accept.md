---
type: C4 Component
title: Accept
status: stable
groma:
  id: accept
  parent: core
  group: Architecture changes
  code:
    - scanner: typescript
      file: src/accept.ts
      dependencies: 3
      dependents: 1
---

Flips a scan-matched ghost to stable in its own file, keeping its identity, its authored OKF document, its Code evidence, and its draft tag.

## Relationships

| Target | Description | Technology |
| --- | --- | --- |
| [Architecture writer](architecture-writer.md) | Writes the accepted document | In-process data |
| [Scan lifecycle](../../scanner/components/scan-lifecycle.md) | Uses complete scan evidence for matching | In-process data |
| [Architecture reader](architecture-reader.md) | Finds the ghost by id | In-process data |
