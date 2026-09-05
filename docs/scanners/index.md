# Scanners

`groma scan` loads the embedded TypeScript scanner and explicitly configured
scanner modules through one registry. It collects every complete language
observation before core writes architecture Markdown. If an enabled scanner is
missing or fails, reconciliation does not start.

```text
source → complete scanner observations → core reconciliation → Markdown
```

An observation contains atomic files and symbols, project scopes, inferred placements, source relationships, and diagnostics. It contains no C4 components or architecture IDs. TypeScript uses imports and directories for placement. C# uses Roslyn projects.

Core keeps curated file membership authoritative. Files already assigned to one component stay together. Only an unknown file becomes a new singleton component under its inferred scope. A drafted name match receives Code but stays a draft until `groma accept`.

`groma scan --watch` repeats the same complete scan after a loaded scanner
matches a changed source path. `groma view` and `groma web` run one scan before
opening, then load one registry for their watch lifecycle. Source and
architecture watch subscriptions are ready before viewer startup completes,
so the first edit can update the open map.

Optional modules are enabled only through `scanners.json` in the selected
`groma/` or `.groma/` directory, normally written by `groma scanner add`.
`groma scanner list` derives built-in, found,
and missing readiness without executing third-party code. Network installation
happens only in `scanner add` and `scanner install`.

Bare `groma` shows scanner readiness beside the embedded Backlog work-source
readiness in one fixed bottom row. The complete scanner inventory and scanner
management syntax remain under Advanced commands.

## Scanners

- [TypeScript](typescript/index.md)
- [C#/.NET](dotnet-csharp/index.md)
- [Shared contract](creating-a-plugin.md)
