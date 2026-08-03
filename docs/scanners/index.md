# Scanners

The Groma scanner turns source code into local architecture Markdown. It owns file watching, invokes the scanner plugin
for the repository's language or ecosystem, and emits canonical architecture documents from the plugin's scan result.

```text
source watcher → scanner plugin → scan result → Markdown emitter
```

Each scanner plugin defines its own supported source contract. A plugin may inspect only the source shapes its contract
declares; it must not infer architectural meaning from unsupported code.

## Scanner plugins

- [TypeScript](typescript/index.md): supported scanner and exact TypeScript/Bun declaration contract
- [.NET/C#](dotnet-csharp/index.md): future scanner direction; behavior and contract are still TBD
