# Observed architecture

This is the architecture known to exist in this repository.

## Start here

- [Groma](systems/groma/system.md) keeps the architecture as Markdown.
- The [human architect](people/human-architect.md) and
  [coding agent](people/coding-agent.md) use it.
- [Core](systems/groma/containers/core/container.md) merges observed
  architecture and planned fragments into one world.
- The [terminal viewer](systems/groma/containers/terminal-viewer/container.md)
  shows that world.
- The [scanner](systems/groma/containers/scanner/container.md) supplies
  source-derived candidates.
- The [architecture workspace](systems/groma/containers/architecture-workspace/container.md)
  keeps the Markdown and versions it through [Git](systems/git/system.md).

The [component Markdown contract](../README.md) defines how these documents
represent C4 elements.
