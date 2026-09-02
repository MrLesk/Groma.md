# Architecture Markdown contract

Groma stores its architecture as an application profile inside an Open
Knowledge Format (OKF) v0.2 bundle. The bundle remains ordinary Markdown:
standard OKF fields describe each concept, the nested `groma` mapping carries
Groma-only architecture metadata, and the body explains the concept and its
outgoing relationships.

Groma supports this explicit architecture profile. It does not load an
unmarked, generic OKF bundle as a Groma project.

## Bundle and project profile

The bundle root is the `groma/` or `.groma/` directory selected by
`groma init`. Groma resolves that choice once and every architecture command
uses the same root. In the paths below, `<groma-root>` means that selected
directory. Its reserved `index.md` contains exactly:

```yaml
---
okf_version: "0.2"
---
```

The root index has no body. `<groma-root>/project.md` identifies the application
profile:

```markdown
---
type: Groma Project
title: Shop
description: Architecture of the shop service
groma:
  profile: architecture
---

The shop service accepts orders and tracks fulfilment.
```

`title` is required. `description` is an optional concise standard OKF field.
The normal Markdown body is the complete project overview, starts with prose,
and has no level-one heading copied from `title`.

Any other `index.md` or `log.md` in the bundle is reserved context Markdown,
never a concept, and the scanner never gives an element one of those names.

## One tree and draft identity

Every concept lives in one tree under `<groma-root>`. Its lifecycle is the
standard top-level `status`: `draft` for a concept that does not exist yet,
`stable` for everything else. A document never moves when its status changes.

A draft is a record at `<groma-root>/drafts/<draft-id>.md`:

```markdown
---
type: Draft
title: Checkout v2
groma:
  id: checkout-v2
---

Customers pay with a saved card.
```

The file name is its immutable lowercase kebab-case ID and the body prose is
the outcome. Concepts that belong to the draft carry `groma.draft: checkout-v2`;
a drafted concept has `status: draft`, and a stable concept may carry the tag
too when the draft touches it. A draft with no `status: draft` concept left is
complete, and its record remains.

Groma does not invent `generated`, `verified`, source provenance, or other
human trust claims.

## Files and containment

Every C4 concept uses its canonical ownership path:

```text
actors/<actor-id>.md
externals/<system-id>.md
systems/<system-id>/system.md
systems/<system-id>/containers/<container-id>/container.md
systems/<system-id>/containers/<container-id>/components/<component-id>.md
```

The path makes the architecture easy to browse and says which systems are
external, but `groma.id` and `groma.parent` are authoritative for identity and
containment. Every ID is unique in the tree and every parent must resolve. A
drafted concept may name a stable parent. An external system has no
containers.

| Type | Parent |
| --- | --- |
| `C4 Actor` | none |
| `C4 System` | none |
| `C4 Container` | a `C4 System` under `systems/` |
| `C4 Component` | a `C4 Container` |

## Concept frontmatter

Each C4 concept has these standard top-level fields:

| Field | Required | Meaning |
| --- | --- | --- |
| `type` | yes | Exactly `C4 Actor`, `C4 System`, `C4 Container`, or `C4 Component`. |
| `title` | yes | The readable concept name. |
| `description` | no | A concise standard OKF description. |
| `status` | yes | `draft` for a concept that does not exist yet; `stable` otherwise. |

Groma-only fields live together under `groma`:

| Field | Required | Meaning |
| --- | --- | --- |
| `id` | yes | Stable lowercase kebab-case ID, unique in the tree. |
| `parent` | for containers and components | ID of the containing system or container. |
| `draft` | no | ID of the draft record this concept belongs to or that touches it. |
| `group` | no | Readable name of a hand-authored sibling cluster. |
| `technology` | no | Free text naming implementation technology, comma-separated. |
| `code` | no | Scanner-produced source evidence. |

There is no `kind` field. The standard `type` carries the C4 type, and the
body does not repeat `title` as a level-one heading.

Groma owns only the fields above. It tolerates other OKF metadata and unknown
concept types inside an explicitly marked Groma package, and preserves
unowned fields during supported edits. It remains strict about its own nested
fields, C4 containment, and relationships. This preservation makes a Groma
package usable by OKF tooling; it is not a generic OKF import contract.

A group is a narrative overlay on one hierarchy level. It never becomes a
parent and owns no relationships. Scanners never derive groups. `groma edit
--group` and `--ungroup` are the supported writers. `groma edit --combine`
folds unique Code references from empty scan records into one component, and
`groma edit --parent` moves an empty scanned component without changing its
identity.

The architecture model owns IDs. Groma assigns an ID when it drafts a concept
or when a scan finds a previously unknown source. A drafted concept keeps its
ID and its file when accepted. Architecture IDs live in Markdown, not
application source.

### Code references

`groma.code` is a list. Each entry contains only:

| Field | Required | Meaning |
| --- | --- | --- |
| `scanner` | yes | Scanner that found the reference. |
| `file` | yes | Exact repository-relative source file. |
| `symbol` | no | Relevant symbol or entry point; omitted when the complete file is useful. |
| `dependencies` | no | Count of source files this file depends on. |
| `dependents` | no | Count of source files that depend on this file. |

Multiple scanners may contribute references to one element. Code references
appear in details; they are not C4 concepts or another viewer level. Later
scans may refresh supported symbols but preserve curated file membership,
unowned metadata, and authored Markdown.

## Markdown body

Consecutive prose paragraphs at the start of a C4 concept body form its long
Groma `overview`. The overview may be empty, which is useful for a concept
created from scan evidence. A named section ends the leading overview.

These level-two sections are supported:

- `## Requirements` states constraints the result must satisfy.
- `## Technology` explains implementation technology in prose.
- `## Relationships` contains the canonical outgoing relationship table.

Other named sections remain authored Markdown. Groma preserves them when it
edits overview or owned metadata.

```markdown
## Relationships

| Target | Description | Technology |
| --- | --- | --- |
| [Readable target name](relative/path/to/target.md) | What this concept does with the target | How the interaction works |
```

Each row declares one direction: the current concept is the source. The link
must resolve to another C4 concept in the tree. `groma relate` adds or removes
a relationship row.

A software-to-software relationship is authored on the lowest concepts that
exist. Once two components participate, write the row there, not again on
their containers or systems. Parents render as connected because the child
row exists. Actor-to-system relationships and parent rows with no lower pin
stay on those concepts.

`Description` states the intent. `Technology` states the mechanism for an
observed relationship, or a required constraint for a drafted one. Both cells
are required and non-empty.

## Component example

```markdown
---
type: C4 Component
title: Ordering
description: Order lifecycle coordinator
status: stable
groma:
  id: ordering
  parent: commerce-api
  code:
    - scanner: typescript
      file: packages/orders/src/orders-service.ts
      symbol: OrdersService
---

Owns the lifecycle of an order from placement through completion.

## Technology

TypeScript, NestJS, and PostgreSQL.

## Relationships

| Target | Description | Technology |
| --- | --- | --- |
| [Payments](../payments.md) | Requests payment authorization | Internal API |
```

The live [Groma system](../groma/systems/groma/system.md) and
[MVP draft](../groma/drafts/mvp.md) are a complete package example.
