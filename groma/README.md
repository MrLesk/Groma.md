# Component Markdown contract

Groma stores one C4 element per Markdown file. The document is both the canonical
architecture record and ordinary documentation: YAML frontmatter carries the minimum
machine-readable identity, containment, and high-level Code references, while the body
explains the element and its outgoing relationships to a reader.

The same document format is used across architecture locations:

- `groma/observed/` is the architecture currently known to exist.
- `groma/missing/` contains source-backed elements absent from complete scanner results while deletion intent is
  resolved.
- Each directory directly under `groma/plans/` is one planned feature. Per the
  [product model](../docs/product-model.md), a plan holds a README and only the element
  Markdown not yet implemented.

The containing directory supplies lifecycle context. Element documents carry architectural meaning while observed,
missing, and planned locations express their relationship to the product lifecycle.

Only documents with the C4 frontmatter below are element documents. Architecture README files and other prose Markdown
are not elements and Groma core does not return them as C4 items.

## Files and containment

All architecture locations follow the C4 ownership hierarchy:

```text
people/<person-id>.md
systems/<system-id>/system.md
systems/<system-id>/containers/<container-id>/container.md
systems/<system-id>/containers/<container-id>/components/<component-id>.md
```

The path makes the architecture easy to browse, but frontmatter is authoritative.
Within one complete architecture model, every `id` must be unique and every
`parent` must resolve to an element in that model. A plan forms its complete
model together with observed architecture. Containment is limited to:

| Kind | Parent |
| --- | --- |
| `person` | none |
| `system` | none |
| `container` | a `system` |
| `component` | a `container` |

## Frontmatter

Frontmatter is the first block in every element document and supports exactly these
fields:

| Field | Required | Meaning |
| --- | --- | --- |
| `id` | yes | Stable identifier in lowercase kebab-case, unique within its complete architecture model. |
| `kind` | yes | One of `person`, `system`, `container`, or `component`. |
| `parent` | for containers and components | The stable `id` of the containing system or container. |
| `external` | no | `true` only for a system outside the architecture's ownership boundary; absence means `false`. |
| `code` | no | High-level scanner-produced source references for a component. |

No other frontmatter field is part of the contract. In particular, there is no
`claim` field: observed versus planned meaning comes only from the containing
directory.

### Code references

`code` is a list on a component document. Each entry contains only:

| Field | Required | Meaning |
| --- | --- | --- |
| `scanner` | yes | The scanner that found the reference. |
| `file` | yes | The exact repository-relative source file. |
| `symbol` | no | The relevant symbol or entry point; omit it when the complete file is the useful reference. |

Multiple scanners may contribute references to the same component. Code references appear in component details; they
are not separate architecture elements, a fourth viewer level, or part of C4 containment.

Groma core may create a recognizable component document from an initial scan result. After a person or coding agent
curates it, core may refresh `code` from later scan results but must not rewrite the Markdown body.

Runtime viewer annotations such as `observed`, `planned`, and `missing` are also not frontmatter fields. Groma core
derives them from architecture location when it builds a viewer model.

## Markdown body

Every document has:

1. One level-one heading containing the element's readable name.
2. One or more prose paragraphs immediately after the heading that describe its
   responsibility or purpose.

These level-two sections are optional:

- `## Technology` describes the implementation technology in prose.
- `## Relationships` contains the outgoing directed relationships in the table
  format below.

Other level-two sections may add human-readable explanation, such as `## Structure`.
They remain prose and do not add model fields.

```markdown
## Relationships

| Target | Description | Technology |
| --- | --- | --- |
| [Readable target name](relative/path/to/target.md) | What this element does with the target | How the interaction works |
```

Each row declares one direction: the element in the current file is the source and
the linked document is the target. The relative Markdown link must resolve from the
source file; the target document's `id` identifies the target. A reverse relationship
exists only when the target document declares its own row. `Description` states the
intent of the interaction. `Technology` states its mechanism; use plain language
rather than model syntax.

## Component example

```markdown
---
id: ordering
kind: component
parent: commerce-api
code:
  - scanner: typescript
    file: packages/orders/src/orders-service.ts
    symbol: OrdersService
  - scanner: nestjs
    file: apps/api/src/orders/orders.controller.ts
    symbol: OrdersController.create
---

# Ordering

Owns the lifecycle of an order from placement through completion.

## Technology

TypeScript, NestJS, and PostgreSQL.

## Relationships

| Target | Description | Technology |
| --- | --- | --- |
| [Payments](../payments.md) | Requests payment authorization | Internal API |
| [Inventory](../inventory.md) | Reserves ordered products | Internal API |
```

## Complete example

The [observed architecture](observed/README.md) combined with the
[MVP plan](plans/mvp/README.md) is a complete example of the document format.
It includes people, internal and external systems, containers, components,
containment, and directed relationships with working relative links.

All element documents are valid CommonMark/GFM with YAML frontmatter and can
be parsed directly by the `comark` npm package. Groma does not require a second
Markdown parser or a second canonical model format.
