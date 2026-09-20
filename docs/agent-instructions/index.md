# Groma agent guides

Help a developer new to this project understand who uses it, what its main
parts do, and how they work together. Read the project's documentation and
source before curating. A scan supplies evidence and initial placement; it
does not settle the architecture.

Groma stores this repository's architecture as Markdown in the selected
`groma/` or `.groma/` directory, written `<groma-root>` in these guides. Change
that architecture only through the `groma` CLI.

## C4 meaning

Use these meanings in every project, regardless of language or scanner:

| Concept | Meaning and what to explain |
| --- | --- |
| Actor | A person in a role, such as Customer or Operator. Explain what they need from the system. |
| Software system | Software that delivers value to its users. Explain its purpose and scope; a repository is not automatically one system. |
| External system | Another software system outside the boundary being described. Explain the interaction with it, without modelling its internals. |
| Container | An application or data store with a runtime or storage boundary, such as a web application, command-line application, worker, or database. Explain its job and implementation technology. This does not mean a Docker container. |
| Component | Related functionality inside one container, with a clear responsibility and interface through which other parts use it. It may need several source files and is not independently deployed. |
| Code | The files, classes, functions, and other implementation details behind a component. Keep exact source references useful for inspection; each code item does not need its own architecture box. |

Systems contain containers; containers contain components. A package,
directory, framework component, or import alone does not establish one of
these boundaries. An owned database can be a container even when hosted by
another provider. If the evidence does not establish a boundary, report that
uncertainty rather than inventing an application or relationship.

These definitions follow the [C4 model](https://c4model.com/abstractions).
Groma adds groups and flows: a group names related sibling components while
keeping their separate responsibilities; a flow explains one scenario through
ordered relationships. Neither adds a C4 containment level.

## What to annotate

- Give elements names and explanations based on their responsibility in this
  project. Describe the existing design, not a proposed redesign.
- Use a short description for the summary and an overview for the useful
  detail. Record technology when known and relevant. Preserve existing useful
  meaning; avoid filling fields with repeated text or guesses.
- Combine implementation details that serve one responsibility. Keep distinct
  responsibilities separate, and group related siblings when it helps readers.
  Box count and file size do not determine the architecture.
- Add relationships that explain actual interactions: who uses whom, for what,
  and how. Imports are evidence to investigate, not sufficient descriptions of
  collaborations. Add flows for important scenarios whose steps are supported.

Open Knowledge Format (OKF) 0.2 provides the portable Markdown representation:
ordinary readers can understand titles, descriptions, body text, and links.
Groma interprets its own metadata for containment, source ownership, and map
presentation. Use the CLI to maintain that metadata and source references.

## Curation workflow and expected result

When asked to curate, work through inspect, structure, describe, and
relationships in that order. An inspection request only calls for an
explanation of the current architecture.
Ask the user only when missing context materially changes the interpretation.
Settle structure before adding prose: current moves and combines have
restrictions on authored meaning. Current relationships cannot be removed, so
check a claim before adding it. If a CLI restriction blocks the required
correction, explain the blocker; do not erase useful meaning to bypass it.

Before handing back the map:

- Check that a new reader can identify the users, system purpose, application
  and data boundaries, major responsibilities, and important interactions.
- Inspect the rendered map and source links. Actors belong to the west and
  external systems to the east under Groma's layout rules, not a C4 requirement.
  Preserve the true relationship direction; report layout defects separately.
- Follow the structure guide's rescan checks to confirm the curation survives.
  Summarize the changes and any unsupported or uncertain areas. Fewer boxes
  alone do not demonstrate a better architecture.

## Task guides

Read the guide for the current job; each guide prints on its own. Command
syntax and operation-specific restrictions belong in these guides and
`--help`.

| Guide | Read it when you | Command |
| --- | --- | --- |
| Inspecting a scan | scan the repository or read and explain the current architecture | `groma agent-instructions inspect` |
| Curating structure | decide which elements exist, where they belong, and which files each owns | `groma agent-instructions structure` |
| Describing elements | write titles, summaries, responsibilities, or technology | `groma agent-instructions describe` |
| Relationships and flows | record how elements interact or walk through a scenario | `groma agent-instructions relationships` |
| Backlog task links | change repository files for a Backlog task and the `backlog` CLI is available | `groma agent-instructions backlog` |

Every command explains its options through `--help`. Run `groma instructions`
for the human guides.
