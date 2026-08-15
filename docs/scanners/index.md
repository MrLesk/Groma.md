# Scanners

`groma scan` reads this repository, sends the result to Groma core, and
prints `ok` plus a short summary. It does not print the architecture. Core
writes or refreshes Markdown. The command runs once and exits.

```text
groma scan → plugin result → core writes Markdown → ok
```

The plugin result contains names, responsibilities, relationships, optional
people, and Code references. A Code reference is the scanner, an exact
repository-relative file, and an optional symbol. That result does not
contain architecture IDs and is not the user-facing output.

Core matches a candidate to an existing `code` reference, else to the
kebab-case of its name. An observed match refreshes `code` and keeps the
body. A ghost match attaches `code` to the planned document and leaves it
planned. Anything else becomes a new observed file. After the first write,
scans never rewrite the body. A scan never turns a ghost into observed
architecture. `groma accept` needs that match.

See [Creating a scanner plugin](creating-a-plugin.md) for the shared
interface. TypeScript is one plugin, not the model. Core never reads
`package.json` or other language project files.

## Scanner plugins

- [TypeScript](typescript/index.md)
- [.NET/C#](dotnet-csharp/index.md)
