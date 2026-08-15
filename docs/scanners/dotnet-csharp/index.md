# .NET/C# scanner

Status: **TBD**

.NET/C# has its own plugin implementing Groma's shared scanner-plugin
interface. Its source contract will live in this directory when a concrete
.NET example defines the mapping.

TypeScript is not Groma's source language. `package.json`, `tsconfig`, npm
workspaces, and other TypeScript project facts belong only in the TypeScript
plugin. They must not appear in Groma core, the scan-result model, or
architecture Markdown. A C# plugin will use `.csproj`, solutions, and C#
declarations the same way: inside this plugin, never in core.

Shared scanner concepts stay language-neutral. A scanner contract is added
here only when a real .NET/C# example exists.
