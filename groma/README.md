# Component Markdown contract

Groma stores one C4 element per Markdown file. The document is both the canonical
architecture record and ordinary documentation: YAML frontmatter carries the minimum
machine-readable identity and containment data, while the body explains the element
and its outgoing relationships to a reader.

The same document format is used in both revision locations:

- `groma/observed/` is the current materialized architecture.
- Each directory directly under `groma/plans/` is one complete desired architecture
  revision.

The containing directory supplies all revision context. Element documents do not
declare a revision, claim, status, lifecycle phase, diagram coordinates, or other
layout state.

## Files and containment

A revision follows the C4 ownership hierarchy:

```text
people/<person-id>.md
systems/<system-id>/system.md
systems/<system-id>/containers/<container-id>/container.md
systems/<system-id>/containers/<container-id>/components/<component-id>.md
```

The path makes the architecture easy to browse, but frontmatter is authoritative.
Within a revision, every `id` must be unique and every `parent` must resolve to an
element in that revision. Containment is limited to:

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
| `id` | yes | Stable, revision-wide unique identifier in lowercase kebab-case. |
| `kind` | yes | One of `person`, `system`, `container`, or `component`. |
| `parent` | for containers and components | The stable `id` of the containing system or container. |
| `external` | no | `true` only for a system outside the architecture's ownership boundary; absence means `false`. |

No other frontmatter field is part of the contract. In particular, there is no
`claim` field: observed versus planned meaning comes only from the containing
revision directory.

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

## Complete example

[Revision 02 — Live viewer](plans/02-live-viewer/README.md) is a complete example of
the contract:

- [Human architect](plans/02-live-viewer/people/human-architect.md) and
  [Coding agent](plans/02-live-viewer/people/coding-agent.md) are people.
- [Groma](plans/02-live-viewer/systems/groma/system.md) is the internal software
  system, while [Git](plans/02-live-viewer/systems/git/system.md) is an external
  system.
- [Viewer](plans/02-live-viewer/systems/groma/containers/viewer/container.md) and
  [Architecture workspace](plans/02-live-viewer/systems/groma/containers/architecture-workspace/container.md)
  are containers parented by `groma`.
- [Markdown reader](plans/02-live-viewer/systems/groma/containers/viewer/components/markdown-reader.md)
  and its peers are components parented by `viewer`.
- The relationship tables are readable source-to-target statements and use working
  relative links.

All element documents in that directory are valid CommonMark/GFM with YAML
frontmatter and can be parsed directly by the `comark` npm package. Groma does not
require a second Markdown parser or a second canonical model format.
