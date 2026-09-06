# Architecture Markdown contract

Groma stores its architecture as an application profile inside an Open
Knowledge Format (OKF) v0.2 bundle. The bundle remains ordinary Markdown:
standard OKF fields describe each concept, the nested `groma` mapping carries
Groma-only architecture metadata, and the body explains the concept. A supporting Markdown record holds authored
relationships.

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

Every C4 concept lives in one tree under `<groma-root>`. Its lifecycle is the
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

Multiple scanners may contribute references to one element. Code references
appear in details; they are not C4 concepts or another viewer level. Later
scans may refresh supported symbols but preserve curated file membership,
unowned metadata, and authored Markdown.

Raw imports, call graphs, provider alternatives, and inference inputs stay in
memory during scanning. They are not Code-reference metadata. Core saves only
selected interactions in the relationship document. Reloads and exports use
those statements without running the scanner. Runtime footprint counts come
from distinct stored file interactions and are not written into Code references.

## Markdown body

Consecutive prose paragraphs at the start of a C4 concept body form its long
Groma `overview`. The overview may be empty, which is useful for a concept
created from scan evidence. A named section ends the leading overview.

These level-two sections are supported:

- `## Requirements` states constraints the result must satisfy.
- `## Technology` explains implementation technology in prose.

Other named sections remain authored Markdown. Groma preserves them when it
edits overview or owned metadata.

## Relationships

Authored and automatically derived relationships live in `<groma-root>/relationships.md`, a supporting
OKF concept with type `Groma Relationships`. It is not a C4 element, a parent,
or another map level. Its ordinary Markdown links identify the exact endpoints:

```markdown
---
type: Groma Relationships
title: Architecture relationships
---

## Relationships

| Source | Target | Description | Technology |
| --- | --- | --- | --- |
| [Checkout client](../src/checkout-client.ts) | [Payment endpoint](../src/payment-endpoint.ts) | Requests payment authorization | HTTPS |
| [Customer](actors/customer.md) | [Shop](systems/shop/system.md) | Places an order | Browser |
```

Code-to-code declarations require exact repository-relative source files with
known component owners. They never use internal component, container, or
system IDs as endpoints. This includes interactions without imports, such as
an HTTP client and its endpoint. An actor or external-system declaration may
use C4 concept links. Each ordered endpoint pair has one authored row.
`Description` states the interaction; `Technology` states its mechanism or a
required constraint. Both cells are required and non-empty.

`groma add relation <source-file> <target-file> --description <text>
--technology <text>` declares a current interaction. `groma edit relation`
changes its text. The web editor selects the participating source files;
relationship details distinguish derived interactions from authored rows. Editing
a derived interaction creates authored text for that exact endpoint pair.
An actor or external-system declaration accepts its concept IDs instead.

Planned interactions use the same columns under `## Draft relationships`.
`groma draft relation <source-file> <target-file> --description <text>
--technology <text>` creates a planned row. Edits keep its status. `groma accept
relation <source-file> <target-file>` explicitly accepts it; only draft rows
may be removed. This lifecycle is independent of the endpoint statuses.
Finding a source dependency does not accept a draft interaction.

Core writes selected current interactions under `## Derived relationships`,
using the same four columns. A complete scan replaces that section and preserves
all authored sections. A failed scanner does not start reconciliation. Raw
source dependencies never become rows merely because their endpoints resolve.
The current [inference rule](relationship-inference.md#current-inference-rule)
covers concretely supplied named callbacks; other interactions may be authored.

A current authored row takes precedence over a derived row for the same exact
file pair. Editing a derived row takes authorship of its text. Subsequent scans
may record the underlying derived interaction again, but the map uses the
current authored statement. A draft row stays separate and is never accepted
by a scan. This is authorship precedence, not a claim that the scanner verified
the authored description.

### Ownership and map projection

In Groma's current profile, each source file has one component owner. This is
an application constraint, not a universal OKF or C4 rule. Many other files
may use it. A scan preserves curated membership and never follows dependencies
to claim ownership. Source ownership does not establish runtime placement.

Core projects file connections through their current owners. Several file
pairs become one directed component connection while retaining their exact
endpoints and individual claims. Connections inside one component add no map self-link. Regrouping preserves
the stored rows; the next scan omits derived interactions whose providers
now have the same owner. Moving or
combining empty components changes this projection without rewriting file
interactions.

At container and system levels, an interaction keeps its original statement.
A callback across assigned containers is still a source-code callback; it does
not establish a network request or inter-process boundary. Core does not invent
transitive edges or turn aggregated paths into executable workflows.

For two-way derived interactions between components, the map points toward
the direction with more distinct supporting file pairs. Equal counts keep
both directions visible. Details retain both directions and their counts.
Authored interactions keep their declared direction. This display rule does
not change the underlying interaction claims.

An ordinary Markdown reader can follow the file and concept links and read
each authored interaction. Groma interprets ownership, authorship, and
the relationship sections to project the map. Source inventory and inferred
placement are not proof of cohesive C4 responsibilities; curated ownership
provides those boundaries.

## Flows

A relationship may carry a derived or authored interaction. A flow supplies
the scenario meaning and order; the existence of an interaction alone does
not establish execution order. A flow uses an
explicit, ordered subset of the directed relationships. It is an OKF concept with type `Groma Flow`, stored at
`<groma-root>/flows/<id>.md`. It is not a C4 element and has no parent,
Code references, footprint, or routes of its own.

```markdown
---
type: Groma Flow
title: Place an order
description: Record a customer's order.
groma:
  id: place-order
---

The customer submits an order. Ordering checks the payment before recording it.

## Steps

| From | To | Action |
| --- | --- | --- |
| [Customer](../actors/customer.md) | [Ordering][ordering] | Submit the order |
| [Ordering][ordering] | [Payments][payments] | Authorize this payment |

[ordering]: ../systems/shop/containers/api/components/ordering.md
[payments]: ../systems/shop/containers/api/components/payments.md
```

`title`, a unique stable `groma.id`, overview prose, and the Steps table are
required. `description` is optional. From and To accept normal inline or
reference-style Markdown links to C4 documents. Each row must resolve exactly
one existing directed relationship in the loaded revision. Missing endpoints,
missing relationships, and ambiguous endpoint pairs are errors.

Table order is execution order. A relationship may occur more than once.
Action explains what happens in this scenario; the relationship remains the
owner of the general collaboration and technology. Core never follows other
outgoing connections to extend a flow.

`groma add flow <title> --overview <prose> --steps <markdown-table>` authors a
record. The table may include Markdown link definitions. `groma edit <flow-id>`
accepts `--title`, `--description`, `--overview`, and `--steps`;
`groma remove <flow-id>` removes it. A referenced relationship or endpoint
cannot be removed while a flow still uses it. Live, historical, and static
viewers all read these same records.

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

```

The live [Groma system](../groma/systems/groma/system.md) and
[MVP draft](../groma/drafts/mvp.md) are a complete package example.
