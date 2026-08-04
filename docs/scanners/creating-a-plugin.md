# Creating a scanner plugin

A scanner plugin is the adaptation boundary between one source ecosystem and Groma. It translates ecosystem-specific
source into the shared scan-result model understood by Groma core. Groma owns the interface and core consumes its
canonical result.

## Responsibility

A plugin defines which source shapes it understands and what architectural meaning can be derived from them. It returns
one complete, deterministic scan result through Groma's scanner-plugin interface. The interface also provides a standard
unsupported-source outcome for projects outside the plugin's recognized source contracts.

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
| `code`      | An implementation element that explains a component         | `component`    |
| `person`    | A human or external actor interacting with the architecture | none; optional |

Each element contains a stable ID, type, name, human-readable responsibility, parent ID where the C4 hierarchy requires
one, relevant technology, and source evidence. A result contains the C4 levels justified by the source evidence; people
are included when the plugin can identify them from the project.

Relationships contain a source ID, target ID, human-readable architectural intent, relevant technology or mechanism, and
source evidence. Entry points identify where execution enters a reported element. Source evidence uses locations
relative to the project root that connect every reported concept to the code that supports it.

The result also identifies the plugin and source-contract version that produced it. Elements and relationships use
Groma's shared types and ordering so Groma core receives the same model from every ecosystem. The source contract must
explain every stable identity and piece of architectural meaning; filenames and framework structure are evidence unless
the contract explicitly gives them architectural meaning.

A scan result is transient input expressed entirely through Groma's domain concepts. Groma core evaluates that result
before representing accepted architecture as observed, missing, planned, or revised Markdown state.

## The source contract

Each plugin documents its source contract inside its own directory under `docs/scanners/`. The contract defines:

- The concrete source shapes the plugin supports.
- How those shapes express stable identity, responsibility, technology, relationships, and evidence.
- The complete scan result produced from an approved example.
- How unrecognized source is represented through the shared interface.
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
