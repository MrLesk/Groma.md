# Observed architecture

This is the architecture known to exist in this repository. Groma writes
these files. Planned fragments appear as ghosts until `groma accept`
applies them after a scan has matched them.

## Start here

- [Groma](systems/groma/system.md) keeps the architecture as Markdown.
- Its users are the [human architect](people/human-architect.md) and
  [coding agent](people/coding-agent.md).
- The [architecture workspace](systems/groma/containers/architecture-workspace/container.md)
  keeps observed and planned architecture in the repository and declares its
  relationship to [Git](systems/git/system.md).
- The [scanner](systems/groma/containers/scanner/container.md) supplies
  recognizable source-derived starting points and Code references to Groma
  core.

The [component Markdown contract](../README.md) defines how these documents
represent C4 elements, containment, and directed relationships.
