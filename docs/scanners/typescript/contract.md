# TypeScript scanner contract

The TypeScript scanner plugin adapts supported TypeScript source shapes to Groma's scanner-plugin interface. It receives
a project root and returns Groma's shared scan-result model.

## Project compatibility

The plugin supports only concrete source shapes documented and approved through a real example. It does not promise to
interpret every TypeScript project. Project configuration, package metadata, declarations, imports, calls, and framework
conventions are used only where that supported example gives them architectural meaning.

## Architectural interpretation

The plugin produces a first architecture recognizable enough for a person or coding agent to navigate and improve. Each
reported component has a stable ID, readable name and responsibility, required containment, supported relationships, and
high-level Code references.

Each Code reference contains `scanner: typescript`, an exact repository-relative `file`, and an optional `symbol` for the
relevant declaration or entry point. It is an overview, not a complete file or symbol inventory.

## Groma interface

The plugin returns one complete result through
Groma's [shared scanner-plugin interface](../creating-a-plugin.md#the-shared-interface). Every reported element is typed
as a C4 `system`, `container`, or `component`. A result may also include `person` elements identified from project
evidence. Code references belong to components and are not separate architecture elements.

TypeScript syntax trees, compiler objects, and framework metadata remain internal evidence used to produce those C4
concepts and Code references.

The result is deterministic for the same supported project state.

## Core handoff

A scan result is transient input to Groma core. The plugin owns TypeScript source interpretation. Groma core owns domain
evaluation, reconciliation with observed and missing architecture, storage decisions, and Markdown representation. A
later scan still only returns data; core may refresh `code` frontmatter from it but never rewrites the curated Markdown
body.

The scanner surrounding the plugin owns source watching and decides when another scan is needed. The viewer remains
separated from source scanning and consumes only the architecture exposed by Groma core.
