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

Every other `index.md` is reserved context Markdown and has no frontmatter.
If a bundle contains a reserved `log.md`, it also has no frontmatter and uses
level-two `YYYY-MM-DD` date headings. Reserved files are never concepts.

## Revisions and plan identity

Groma uses the same concept format in three locations:

- `<groma-root>/observed/` contains architecture known to exist. It may be empty.
- `<groma-root>/missing/` contains the dotted historical comparison revision.
- Each directory directly under `<groma-root>/plans/` is one desired architecture
  fragment.

The plan directory name is its immutable, meaningful lowercase kebab-case ID.
Its reserved `index.md` supplies the readable plan context and optional
`## Outcome` section. A plan with no remaining C4 concept documents is
complete, and its index remains as the plan record.

Planned concepts have `status: draft`. Observed, missing, and accepted concepts
have `status: stable`. Groma does not invent `generated`, `verified`, source
provenance, or other human trust claims.

## Files and containment

Every C4 concept uses its canonical ownership path:

```text
actors/<actor-id>.md
systems/<system-id>/system.md
systems/<system-id>/containers/<container-id>/container.md
systems/<system-id>/containers/<container-id>/components/<component-id>.md
```

The path makes the architecture easy to browse, but `groma.id` and
`groma.parent` are authoritative. Core merges observed architecture, missing
architecture, and every plan into one world. In each revision every ID is
unique and every parent must resolve. A plan is a fragment: it may name an
observed parent without copying that parent. A required change restates an
observed ID; that box remains planned until `groma accept` applies it.

| Type | Parent |
| --- | --- |
| `C4 Actor` | none |
| `C4 System` | none |
| `C4 Container` | a `C4 System` |
| `C4 Component` | a `C4 Container` |

## Concept frontmatter

Each C4 concept has these standard top-level fields:

| Field | Required | Meaning |
| --- | --- | --- |
| `type` | yes | Exactly `C4 Actor`, `C4 System`, `C4 Container`, or `C4 Component`. |
| `title` | yes | The readable concept name. |
| `description` | no | A concise standard OKF description. |
| `status` | yes | `draft` for planned concepts; `stable` otherwise. |

Groma-only fields live together under `groma`:

| Field | Required | Meaning |
| --- | --- | --- |
| `id` | yes | Stable lowercase kebab-case ID, unique in the merged world. |
| `parent` | for containers and components | ID of the containing system or container. |
| `external` | no | `true` only for a system outside the ownership boundary. |
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

The architecture model owns IDs. Groma assigns an ID when it authors a planned
or observed concept, or when a scan finds a previously unknown source. A
planned addition keeps its ID when accepted. Architecture IDs live in
Markdown, not application source.

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
must resolve to another C4 concept in the same revision. `groma relate` adds or
removes an observed relationship row.

A software-to-software relationship is authored on the lowest concepts that
exist. Once two components participate, write the row there, not again on
their containers or systems. Parents render as connected because the child
row exists. Actor-to-system relationships and parent rows with no lower pin
stay on those concepts.

`Description` states the intent. `Technology` states the mechanism for an
observed relationship, or a required constraint for a planned relationship.
Both cells are required and non-empty.

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

The live [observed architecture](../groma/observed/index.md) and
[MVP plan](../groma/plans/mvp/index.md) are a complete package example.
