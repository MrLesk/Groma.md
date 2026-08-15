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

## The shared interface

Each candidate has one of these types:

| Type        | Meaning                                                     | C4 parent      |
|-------------|-------------------------------------------------------------|----------------|
| `system`    | A software system that delivers value independently         | none           |
| `container` | An application or data store that makes a system work       | `system`       |
| `component` | A cohesive responsibility inside a container                | `container`    |
| `person`    | A human or external actor interacting with the architecture | none; optional |

A component may carry Code references:

```yaml
code:
  - scanner: typescript
    file: packages/orders/src/orders-service.ts
    symbol: OrdersService
```

`scanner` and `file` are required. `file` is relative to this repository.
`symbol` is omitted when the complete file is the useful reference.

Each candidate otherwise contains the smallest information needed: type,
recognizable name and responsibility, parent evidence, relevant technology,
relationships, and Code references. It does not contain an architecture ID.

Core evaluates the result against the current world using the rules in the
[product model](../product-model.md).

## The source contract

Each plugin documents its source contract under `docs/scanners/`. The
contract names the concrete source shapes it supports and the scan result
from one approved example. There is no contract until that example exists.

The [TypeScript scanner](typescript/index.md) is the first plugin. It has no
approved example yet. The [.NET/C# scanner](dotnet-csharp/index.md) is the
same interface for another ecosystem. Neither plugin is Groma core.
