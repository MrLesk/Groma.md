# Scanners

`groma scan` loads scanner modules from one registry and collects every complete language observation before core writes architecture Markdown. It prints `ok` and counts of created, refreshed, and planned matches. If any scanner fails, reconciliation does not start.

```text
source → complete scanner observations → core reconciliation → Markdown
```

An observation contains atomic files and symbols, project scopes, inferred placements, source relationships, and diagnostics. It contains no C4 components or architecture IDs. TypeScript uses imports and directories for placement. C# uses Roslyn projects.

Core keeps curated file membership authoritative. Files already assigned to one component stay together. Only an unknown file becomes a new singleton component under its inferred scope. A planned name match receives Code but stays planned until `groma accept`.

`groma scan --watch` repeats the same complete scan after supported TypeScript
or C# source and project changes settle. `groma view` and `groma web` run one
scan before opening, then use that watch in-process.

## Scanners

- [TypeScript](typescript/index.md)
- [C#/.NET](dotnet-csharp/index.md)
- [Shared contract](creating-a-plugin.md)
