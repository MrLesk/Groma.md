# Component Markdown contract

Groma stores one C4 element per Markdown file. The document is both the
canonical architecture record and ordinary documentation: YAML frontmatter
carries the minimum machine-readable identity, containment, and high-level
Code references, while the body explains the element and its outgoing
relationships to a reader.

The same document format is used in two locations:

- `groma/observed/` is the architecture currently known to exist. It may be
  empty.
- Each directory directly under `groma/plans/` is one plan fragment. Per the
  [product model](product-model.md), Groma writes its README and the
  element Markdown that is not yet accepted.

The containing directory supplies lifecycle context. Only documents with the
C4 frontmatter below are element documents. README files and other prose are
not elements.

## Plan identity

Every plan README begins with one immutable, meaningful lowercase kebab-case
ID:

```yaml
---
id: mvp
---
```

The plan directory must have the same name as its unique ID. The README
heading is the editable readable name. A plan with no remaining element
documents is complete, and its README remains as the plan record.

## Files and containment

All architecture locations follow the C4 ownership hierarchy:

```text
actors/<actor-id>.md
systems/<system-id>/system.md
systems/<system-id>/containers/<container-id>/container.md
systems/<system-id>/containers/<container-id>/components/<component-id>.md
```

The path makes the architecture easy to browse, but frontmatter is
authoritative. Core merges observed architecture and every plan into one
world. In that world every `id` is unique and every `parent` must resolve to
an element. A plan is a fragment: it may name an observed parent without
copying that parent into the plan. A required change restates an observed
ID; that one box is planned until `groma accept` applies it.

Containment is limited to:

| Kind | Parent |
| --- | --- |
| `actor` | none |
| `system` | none |
| `container` | a `system` |
| `component` | a `container` |

## Frontmatter

Frontmatter is the first block in every element document and supports exactly
these fields:

| Field | Required | Meaning |
| --- | --- | --- |
| `id` | yes | Stable, meaningful identifier in lowercase kebab-case, unique in the merged world. |
| `kind` | yes | One of `actor`, `system`, `container`, or `component`. |
| `parent` | for containers and components | The stable `id` of the containing system or container. |
| `external` | no | `true` only for a system outside the architecture's ownership boundary; absence means `false`. |
| `group` | no | Readable name of a hand-chosen cluster. Siblings with the same parent and the same `group` render inside one boundary labeled with that name. |
| `technology` | no | Free text naming the implementation technology, comma-separated. Core reads it and the details pane shows each part under How it's built. |
| `code` | no | Scanner-produced source references for this element. |

No other frontmatter field is part of the contract. Observed versus planned
meaning comes only from the containing directory.

A group is a narrative overlay on one level of the hierarchy: it never
becomes a parent, owns no relationships, and only an author writes it:
scanners never derive groups.

The architecture model owns IDs. Groma is the only writer of these files. A
planned addition receives its ID when Groma authors it and keeps that ID
when accepted. A required change restates the observed ID. Core assigns an
ID only when a scan finds something that is not already in the world.
Architecture IDs live in Markdown, not application source.

### Code references

`code` is a list on an element document. Each entry contains only:

| Field | Required | Meaning |
| --- | --- | --- |
| `scanner` | yes | The scanner that found the reference. |
| `file` | yes | The exact repository-relative source file. |
| `symbol` | no | The relevant symbol or entry point; omit it when the complete file is the useful reference. |

Multiple scanners may contribute references to the same element. Code
references appear in details; they are not separate architecture
elements, a fourth viewer level, or part of C4 containment. Core uses them
to reconcile later scans with stable observed elements.

After the first write of a document, core may refresh supported symbols from
later scans but must preserve curated file membership and the Markdown body.

Runtime viewer annotations such as `observed` and `planned` are not
frontmatter fields. Groma core derives them from architecture location.

## Markdown body

Every document has:

1. One level-one heading containing the element's readable name.
2. One or more prose paragraphs immediately after the heading that describe
   its responsibility or purpose.

These level-two sections are optional:

- `## Requirements` states constraints the result must satisfy. Plans use
  this for what must be true, not how to implement it.
- `## Technology` describes the implementation technology in prose. Observed
  documents may use it. Planned documents omit it unless a requirement
  forces a technology.
- `## Relationships` contains the outgoing directed relationships in the
  table format below.

Other level-two sections may add human-readable explanation. They remain
prose and do not add model fields.

```markdown
## Relationships

| Target | Description | Technology |
| --- | --- | --- |
| [Readable target name](relative/path/to/target.md) | What this element does with the target | How the interaction works |
```

Each row declares one direction: the element in the current file is the
source. The target is the element whose document the row's link reaches; a
link that reaches no element document is an error. Core resolves parents by
`id` across the merged world.

A software-to-software relationship is authored on the lowest elements
that exist. Once two components participate, write the row there and not
again on their containers or systems. Parents show as connected because
that child row exists. An actor-to-system relationship, and a parent row
with no lower pin yet, stay on those documents.

`Description` states the intent of the interaction. On an observed document,
`Technology` states its mechanism. On a planned document it may state a
required constraint or be omitted.

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
---

# Ordering

Owns the lifecycle of an order from placement through completion.

## Technology

TypeScript, NestJS, and PostgreSQL.

## Relationships

| Target | Description | Technology |
| --- | --- | --- |
| [Payments](../payments.md) | Requests payment authorization | Internal API |
```

## Complete example

The [observed architecture](../groma/observed/README.md) combined with the
[MVP plan](../groma/plans/mvp/README.md) is a complete example of the document
format: observed actors, systems, containers, and components, plus planned
fragments that add new IDs only.

All element documents are valid CommonMark/GFM with YAML frontmatter and can
be parsed directly by the `comark` npm package.
