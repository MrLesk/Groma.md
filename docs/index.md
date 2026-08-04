# Groma documentation

Groma has three main flows: scan source code into an architecture model, view the current and planned architecture, and
plan a desired architectural change.

## Scan

Scan source code and produce a C4 model in local Markdown files.

- [Scanners](scanners/index.md): the shared scanning flow and available language or ecosystem plugins

## View

Explore observed and missing architecture alongside every plan.

- [Viewer](viewer.md): observed, missing, and planned architecture with live updates
- [Observed architecture](../groma/observed/README.md): the architecture currently represented by this repository

## Plan

Describe one independent, final desired architectural outcome.

- [Product model](product-model.md): observed architecture, plans, revisions, and the implementation lifecycle
- [Component Markdown contract](../groma/README.md): the canonical architecture document format

## Product principles

- [Groma manifesto](../MANIFESTO.md): principles and boundaries that guide the product
