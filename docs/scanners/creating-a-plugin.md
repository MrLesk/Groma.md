# Creating a scanner plugin

A scanner plugin translates one source ecosystem into Groma's shared
scan-result model. Core consumes that result. The plugin does not write
Markdown and does not assign architecture IDs.

A plugin must not require Groma-specific types, comments, or IDs in
application source. Language and ecosystem facts stay in the plugin.
`package.json`, `tsconfig`, `.csproj`, and similar files are not inputs to
Groma core.

```text
source → scanner plugin → scan result → Groma core
```

The TypeScript plugin takes two knobs on its standalone program: a glob
list for which files to read, and an ignore list for files and folders to
skip. `groma scan` and the watch always use the plugin's defaults. A
plugin may also honor the host project's ignore file (the TypeScript
plugin uses `.gitignore`). `groma scan --watch` uses the plugin's default
glob and ignore lists to decide which changed files trigger a scan; it
skips `.git`, `groma`, and `node_modules` and does not read `.gitignore`.
Defaults belong in the plugin, not in Groma core.

There is no plugin registry. `scanRepository` in `src/scanner.ts` calls
the TypeScript plugin's `scanTypeScriptSource` directly, and the watch
filters changed paths with its `isTypeScriptScanFile`. The shared
interface is `ScanResult`, `ScanCandidate`, and `CodeReference` in
`src/types.ts`.

## The shared interface

Each candidate has one of these types:

| Type        | Meaning                                                     | C4 parent      |
|-------------|-------------------------------------------------------------|----------------|
| `system`    | A software system that delivers value independently         | none           |
| `container` | An application or data store that makes a system work       | `system`       |
| `component` | A cohesive responsibility inside a container                | `container`    |
| `actor`     | A human or automated actor interacting with the architecture | none; optional |

A candidate of any kind may carry Code references; the TypeScript plugin
puts one on every container, and `scripts/validate-architecture.ts`
accepts `code` on components only:

```yaml
code:
  - scanner: typescript
    file: packages/orders/src/orders-service.ts
    symbol: OrdersService
```

`scanner` and `file` are required. `file` is relative to this repository.
`symbol` is omitted when the complete file is the useful reference.

Each candidate contains `kind`, `name`, `responsibility`, `parent` (the
parent candidate's name, for containers and components), and optional
`code`. It carries no architecture ID, technology, or relationships.

Core keys new and existing elements by the kebab-case of the name, so two
candidates with the same name collapse into one document and the later
code replaces the earlier. The TypeScript plugin de-duplicates container
names but not component names. A parent is matched by the kebab-case of
its name and must already be in the world or precede its children in the
same result; otherwise the fold throws `missing parent for <id>`. Send a
non-empty responsibility; core writes it as the lead prose and never
rewrites it. An empty responsibility leaves a new document with its
heading and no prose, which `scripts/validate-architecture.ts` rejects.

Core evaluates the result against the current world using the rules in the
[product model](../product-model.md).

## The source contract

Each plugin documents its source contract under `docs/scanners/`. The
contract names the concrete source shapes it supports and the scan result
from one approved example. There is no contract until that example exists.

The [TypeScript scanner](typescript/index.md) is the generic TypeScript
plugin. Nest or Next would be later plugins on the same interface. A
[.NET/C# scanner](dotnet-csharp/index.md) is not built yet; it would be
the same interface for another ecosystem. No plugin is Groma core.
