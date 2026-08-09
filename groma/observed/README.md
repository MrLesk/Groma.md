# Observed architecture

This is Groma's current materialized architecture: readable, Git-native,
C4-compatible Markdown owned by this repository.

## Start here

- [Groma](systems/groma/system.md) keeps the architecture as Markdown.
- Its users are the [human architect](people/human-architect.md) and
  [coding agent](people/coding-agent.md).
- The [architecture workspace](systems/groma/containers/architecture-workspace/container.md)
  keeps observed, missing, and planned architecture in the repository and declares its relationship
  to [Git](systems/git/system.md), which supplies history, diffs, and collaboration.
- The [scanner](systems/groma/containers/scanner/container.md) supplies a recognizable source-derived starting point and
  high-level Code references to Groma core.

The [component Markdown contract](../README.md) defines how these documents represent
C4 elements, containment, and directed relationships.
