# Scanners

Groma scanners turn supported source code into a recognizable architectural starting point. A scanner coordinates
source watching and invokes the plugin for the project's language or ecosystem. Groma core owns the resulting
architecture model.

```text
scan → recognizable architecture → human or agent curation → rescan without lost annotations
```

Every scanner plugin implements Groma's scanner-plugin interface. Each plugin defines the source shapes it supports and
translates them into a shared C4 scan result containing systems, containers, components, relationships, optional people,
and high-level Code references. A Code reference contains the scanner, exact repository-relative file, and optional
symbol. Multiple scanners may contribute references to one component.

Core reconciles the result with observed and missing architecture. It may create the initial component Markdown, but a
later scanner still only returns data. Core updates `code` frontmatter from that result and preserves the curated body.

See [Creating a scanner plugin](creating-a-plugin.md) for the shared interface, source-contract responsibilities, and
the boundary with Groma core.

## Scanner plugins

- [TypeScript](typescript/index.md): TypeScript project interpretation and scanner-plugin contract
- [.NET/C#](dotnet-csharp/index.md): future scanner direction; behavior and contract are still TBD
