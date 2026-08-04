# Scanners

Groma scanners turn supported source code into architectural information. A scanner coordinates source watching and
invokes the plugin for the project's language or ecosystem. Groma core owns the resulting architecture model.

```text
source watcher → scanner plugin → scan result → Groma core
```

Every scanner plugin implements Groma's scanner-plugin interface. Each plugin defines the source shapes it supports and
translates them into a shared C4 scan result containing systems, containers, components, code, relationships, evidence,
and optional people. Core applies domain rules to that canonical result and reconciles observed and missing architecture.

See [Creating a scanner plugin](creating-a-plugin.md) for the shared interface, source-contract responsibilities, and
the boundary with Groma core.

## Scanner plugins

- [TypeScript](typescript/index.md): TypeScript project interpretation and scanner-plugin contract
- [.NET/C#](dotnet-csharp/index.md): future scanner direction; behavior and contract are still TBD
