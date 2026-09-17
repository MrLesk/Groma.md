# Groma agent guides

Groma stores this repository's architecture as Markdown in the selected
`groma/` or `.groma/` directory, written `<groma-root>` in these guides. Change
that architecture only through the `groma` CLI. Read the guide for your current
job; each guide prints on its own.

| Guide | Read it when you | Command |
| --- | --- | --- |
| Inspecting a scan | scan the repository or read and explain the current architecture | `groma agent-instructions inspect` |
| Curating structure | decide which elements exist, where they belong, and which files each owns | `groma agent-instructions structure` |
| Describing elements | write titles, summaries, responsibilities, or technology | `groma agent-instructions describe` |
| Relationships and flows | record how elements interact or walk through a scenario | `groma agent-instructions relationships` |
| Backlog task links | change repository files for a Backlog task and the `backlog` CLI is available | `groma agent-instructions backlog` |

To curate a scan into a finished architecture, work through inspect,
structure, describe, and relationships in that order.

Every command explains its options through `--help`. Run `groma instructions`
for the human guides.
