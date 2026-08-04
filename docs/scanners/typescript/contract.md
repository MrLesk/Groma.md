# TypeScript scanner contract

The TypeScript scanner plugin adapts TypeScript projects to Groma's scanner-plugin interface. It receives a project
root, interprets the source using TypeScript and ecosystem knowledge, and returns Groma's shared scan-result model.

## Project compatibility

The plugin discovers the organization chosen by the project, including applications, packages, features, layers, and
framework conventions. Project configuration, package metadata, source declarations, imports, and call relationships
provide evidence for that discovery.

Architectural meaning comes from responsibilities, boundaries, entry points, and collaborations expressed by the
project. The plugin maps that meaning into Groma concepts independently of the project's package manager, module system,
scripts, directory names, and file boundaries.

## Architectural interpretation

The plugin translates source evidence into architectural meaning that can be explained in the language of the project.
Files and symbols support the identification of cohesive C4 boundaries and collaborations.

Every reported element has a stable conceptual identity and a human-readable responsibility. Every reported relationship
expresses architectural intent. Source locations connect those concepts to their implementation evidence.

The plugin reports architectural interpretations supported by the source patterns it understands.

## Groma interface

The plugin returns one complete result through
Groma's [shared scanner-plugin interface](../creating-a-plugin.md#the-shared-interface). Every reported element is typed
as a C4 `system`, `container`, `component`, or `code` element. A result may also include
`person` elements identified from project evidence.

The result supplies stable IDs, C4 containment, human-readable responsibilities, technologies, relationships, entry
points, and project-relative source evidence through Groma-owned types. TypeScript syntax trees, compiler objects, and
framework metadata remain internal evidence used to produce those C4 concepts.

The result is deterministic for the same project state. Stable architectural identity follows the project concepts that
the plugin recognizes across source organization changes.

## Core handoff

A scan result is transient input to Groma core. The plugin owns TypeScript source interpretation. Groma core owns domain
evaluation, reconciliation with observed and missing architecture, storage decisions, and Markdown representation.

The scanner surrounding the plugin owns source watching and decides when another scan is needed. The viewer remains
separated from source scanning and consumes only the architecture exposed by Groma core.
