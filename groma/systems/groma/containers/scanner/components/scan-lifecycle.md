---
type: C4 Component
title: Scan lifecycle
status: stable
groma:
  id: scan-lifecycle
  parent: scanner
  group: Scan lifecycle
  code:
    - scanner: typescript
      file: src/scanner.ts
      dependencies: 4
      dependents: 5
    - scanner: typescript
      file: src/scanner/registry.ts
      dependencies: 2
      dependents: 1
    - scanner: typescript
      file: src/scan-reconciler.ts
      dependencies: 7
      dependents: 1
---

Preflights every enabled scanner from one explicit registry, runs one complete
multi-language scan or watched rescan, then reconciles the full evidence batch
with stable authored ownership. A new observed C4 concept
uses the OKF profile with stable status and may have an empty body overview;
refresh and ghost matching update only nested Code evidence and lifecycle
status before writing Markdown.

## Relationships

| Target | Description | Technology |
| --- | --- | --- |
| [TypeScript scanner](typescript-scanner.md) | Collects TypeScript evidence | Scan observation |
| [C# scanner](c-scanner.md) | Collects C# evidence | Scan observation |
| [Scanner modules](scanner-modules.md) | Loads only configured and present module entries | ECMAScript module |
| [Scan observation](scan-observation.md) | Validates complete language evidence | In-process data |
| [Architecture reader](../../core/components/architecture-reader.md) | Matches evidence against stable ownership | In-process data |
| [Architecture writer](../../core/components/architecture-writer.md) | Folds the complete batch into Markdown | In-process data |
