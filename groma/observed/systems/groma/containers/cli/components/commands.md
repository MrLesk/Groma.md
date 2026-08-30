---
id: commands
kind: component
parent: cli
group: "Command surface"
code:
  - scanner: typescript
    file: src/cli.ts
    dependencies: 10
    dependents: 0
---

# Commands

Routes every named Groma command and the bare-terminal launcher to one owning operation. It starts viewers, runs scans, authors architecture, and prints command results without deciding architecture meaning.

## Relationships

| Target | Description | Technology |
| --- | --- | --- |
| [Observed curation](observed-curation.md) | Curates scan evidence and collaborations | groma edit and groma relate |
| [Scan lifecycle](../../scanner/components/scan-lifecycle.md) | Runs a complete scan | groma scan |
