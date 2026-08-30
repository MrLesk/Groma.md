---
id: scan-lifecycle
kind: component
parent: scanner
group: "Scan lifecycle"
code:
  - scanner: typescript
    file: src/scanner.ts
    dependencies: 5
    dependents: 3
  - scanner: typescript
    file: src/scan-reconciler.ts
    dependencies: 6
    dependents: 2
---

# Scan lifecycle

Runs one complete multi-language scan or watched rescan, then reconciles the full evidence batch with stable authored ownership before writing Markdown.

## Relationships

| Target | Description | Technology |
| --- | --- | --- |
| [TypeScript scanner](typescript-scanner.md) | Collects TypeScript evidence | Scan observation |
| [C# scanner](c-scanner.md) | Collects C# evidence | Scan observation |
| [Scan observation](scan-observation.md) | Validates complete language evidence | In-process data |
| [Architecture reader](../../core/components/architecture-reader.md) | Matches evidence against stable ownership | In-process data |
| [Architecture writer](../../core/components/architecture-writer.md) | Folds the complete batch into Markdown | In-process data |
