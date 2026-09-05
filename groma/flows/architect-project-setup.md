---
type: Groma Flow
title: 'Architect: project setup'
groma:
  id: architect-project-setup
---

Initialize the repository as a Groma project. Setup saves the project identity and architecture package, prepares the managed agent instructions, and runs the first scan when accepted.

## Steps

| From | To | Action |
| --- | --- | --- |
| [Human architect][human-architect] | [Commands][commands] | Start project setup |
| [Commands][commands] | [Init command][init-command] | Start the repository setup journey |
| [Init command][init-command] | [Project initialization][project-initialization] | Save the chosen project identity and storage root |
| [Project initialization][project-initialization] | [Project profile][project-profile] | Write the project profile |
| [Project initialization][project-initialization] | [Groma filesystem][groma-filesystem] | Create the minimum architecture package |
| [Project initialization][project-initialization] | [Agent instructions][agent-instructions] | Install the managed Groma instruction block |
| [Init command][init-command] | [Scan lifecycle][scan-lifecycle] | Run the accepted first scan |

[human-architect]: ../actors/human-architect.md
[commands]: ../systems/groma/containers/cli/components/commands.md
[init-command]: ../systems/groma/containers/cli/components/init-command.md
[project-initialization]: ../systems/groma/containers/cli/components/project-initialization.md
[project-profile]: ../systems/groma/containers/core/components/project-profile.md
[groma-filesystem]: ../systems/groma/containers/core/components/groma-filesystem.md
[agent-instructions]: ../systems/groma/containers/cli/components/agent-instructions.md
[scan-lifecycle]: ../systems/groma/containers/scanner/components/scan-lifecycle.md
