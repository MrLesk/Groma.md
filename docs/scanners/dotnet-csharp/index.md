# .NET/C# scanner

Status: **not built yet**

No .NET/C# plugin exists. One would implement Groma's shared
scanner-plugin interface and produce the same scan-result model as the
[TypeScript plugin](../typescript/index.md): a list of candidates, each
with a kind, a name, a responsibility, the parent candidate's name for
containers and components, and Code references. Its source contract will
live in this directory when a concrete .NET example defines the mapping.

Groma's scan-result model and architecture Markdown are language-neutral.
`package.json`, `tsconfig`, npm workspaces, and other TypeScript project
facts belong only in the TypeScript plugin. They must not appear in Groma
core, the scan-result model, or architecture Markdown. A C# plugin will
use `.csproj`, solutions, and C# declarations the same way: inside this
plugin, never in core.

Shared scanner concepts stay language-neutral. A scanner contract is added
here only when a real .NET/C# example exists.
