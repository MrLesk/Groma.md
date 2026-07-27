# Observed architecture

This is Groma's current materialized architecture: readable, Git-native,
C4-compatible Markdown owned by this repository.

## Start here

- [Groma](systems/groma/system.md) keeps the architecture as Markdown.
- Its users are the [human architect](people/human-architect.md) and
  [coding agent](people/coding-agent.md).
- The [architecture workspace](systems/groma/containers/architecture-workspace/container.md)
  keeps current and planned revisions in the repository and declares its relationship
  to [Git](systems/git/system.md), which supplies history, diffs, and collaboration.

The [component Markdown contract](../README.md) defines how these documents represent
C4 elements, containment, and directed relationships.
