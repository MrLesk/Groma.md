# Creating a scanner plugin

A scanner plugin is the adaptation boundary between one source ecosystem and Groma. It translates ecosystem-specific
source into the shared scan-result model understood by Groma core. Groma owns the interface and core consumes its
canonical result.

## Responsibility

A plugin defines which source shapes it understands and the recognizable architecture they support. It returns one
complete, deterministic scan result through Groma's scanner-plugin interface. Unsupported source produces no claim.

The surrounding scanner owns source watching and decides when to request a scan. The plugin owns source interpretation.
Groma core owns domain evaluation and reconciles information from the scan result with observed and missing
architecture.

```text
source ecosystem → scanner plugin → shared scan result → Groma core
```

## The shared interface

Every plugin returns a C4 scan result owned by Groma. Each reported architecture element has one of these types:

| Type        | Meaning                                                     | C4 parent      |
|-------------|-------------------------------------------------------------|----------------|
| `system`    | A software system that delivers value independently         | none           |
| `container` | An application or data store that makes a system work       | `system`       |
| `component` | A cohesive responsibility inside a container                | `container`    |
| `person`    | A human or external actor interacting with the architecture | none; optional |

Code is not another architecture element. A component may instead carry a small list of Code references:

```yaml
code:
  - scanner: typescript
    file: packages/orders/src/orders-service.ts
    symbol: OrdersService
```

`scanner` and `file` are required. `file` is relative to the scanned project. `symbol` names the relevant declaration or
entry point and is omitted when the complete file is the useful reference. Repeating the entry allows one or more
scanners to contribute to the same component.

Each element otherwise contains the smallest information needed to produce the approved architecture: stable ID, type,
name, responsibility, required parent, relevant technology, and relationships. Filenames and framework structure remain
evidence unless the source contract explicitly gives them architectural meaning.

A scan result is transient input expressed entirely through Groma's domain concepts. Groma core evaluates that result
before representing accepted architecture as observed or missing Markdown. On rescan, core may replace the `code`
frontmatter but must preserve the component's Markdown body.

## The source contract

Each plugin documents its source contract inside its own directory under `docs/scanners/`. The contract defines:

- The concrete source shapes the plugin supports.
- How those shapes support a recognizable component, its relationships, and its Code references.
- The complete scan result produced from an approved example.
- The boundary between source interpretation and Groma core domain logic.

The source contract is specific to the language or ecosystem. The scanner-plugin interface and scan-result model remain
Groma concepts shared by every plugin.

## Ownership boundaries

- The scanner owns source watching and scan scheduling.
- The plugin owns ecosystem-specific source interpretation and produces the shared scan result.
- Groma core owns domain evaluation, identity reconciliation, plans, revisions, storage, and Markdown representation.
- The viewer owns presentation of the architecture exposed by Groma core.

These boundaries keep source technology within its plugin while every scanner participates in the same product flow.

The [TypeScript scanner](typescript/index.md) illustrates this boundary for TypeScript projects. The
[.NET/C# scanner](dotnet-csharp/index.md) remains TBD.
