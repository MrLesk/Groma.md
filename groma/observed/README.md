# Observed architecture

This is the architecture known to exist in this repository.

## Start here

- [Groma](systems/groma/system.md) keeps the architecture as Markdown.
- The [human architect](people/human-architect.md) and
  [coding agent](people/coding-agent.md) use the CLI, the terminal
  viewer, and the web viewer.
- [CLI](systems/groma/containers/cli/container.md) starts view, web, scan,
  create, edit, and accept.
- [Core](systems/groma/containers/core/container.md) merges observed
  architecture and planned fragments into one world and lays it out for
  both maps.
- The [terminal viewer](systems/groma/containers/terminal-viewer/container.md)
  shows that world in the terminal.
- The [web viewer](systems/groma/containers/web-viewer/container.md) shows
  the same world in the browser as an isometric blueprint.
- The [scanner](systems/groma/containers/scanner/container.md) supplies
  source-derived candidates.
- [Git](systems/git/system.md) versions the Markdown.

The [component Markdown contract](../README.md) defines how these documents
represent C4 elements.
