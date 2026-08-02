# Plan and revision lifecycle

## Purpose

Groma separates future intent from implemented architecture without maintaining
its own project-management history. Plans contain architecture still to be
implemented, observed contains architecture known to exist, and Git commits
provide immutable revisions.

## Terms

### Plan

A plan is an independent, mutable description of one desired feature. It is not
a complete architecture, a numbered step, or the successor of another plan.

Each directory directly under `groma/plans/` contains:

- a `README.md` describing the feature outcome and design information needed
  until the plan is achieved;
- only the architecture element Markdown that has not yet been implemented.

Architecture paths inside a plan mirror their eventual paths beneath
`groma/observed/`. A plan may refer to parents and relationship targets supplied
by the selected revision; it does not copy those elements merely to be
self-contained.

### Observed architecture

Observed architecture is the architecture currently known to exist. Its
canonical Markdown lives under `groma/observed/`.

Implementing planned architecture moves its element Markdown into the matching
observed path. The Markdown remains useful to people and agents independently
of Groma.

### Revision

A revision is the immutable architecture state represented by a Git commit.
Groma does not store revisions in `groma/plans/` or in a separate revisions
directory. A commit SHA identifies a revision; the commit already preserves the
architecture, plans, code, author, time, and message at that point.

A plan may materialize across any number of revisions. Groma does not record an
explicit plan-to-revision mapping.

## Plan layout

For a terminal viewer that has not been implemented:

```text
groma/plans/terminal-viewer/
  README.md
  systems/groma/containers/terminal-viewer/container.md
  systems/groma/containers/terminal-viewer/components/terminal-canvas.md
```

The plan does not copy the Groma system, its existing containers, people, or
external systems. Those already belong to observed architecture at a revision.

## Materialization

Implementation transfers architecture Markdown from the plan to observed in
ordinary commits.

For a new element, the file moves to the identical relative path:

```text
groma/plans/terminal-viewer/systems/groma/containers/terminal-viewer/container.md
  ->
groma/observed/systems/groma/containers/terminal-viewer/container.md
```

For a planned change to an existing element, the planned file is the desired
version at the same relative path. When the change exists, that version replaces
the observed file and is removed from the plan in the same commit.

After each commit:

- observed contains the architecture implemented by that revision;
- the plan contains only architecture still awaiting implementation;
- the plan README continues to describe the outcome being pursued.

This allows one plan to progress across several revisions without lifecycle
metadata. Mirrored relative paths identify the same architectural element.

## Completion

A plan is complete when no architecture element Markdown remains beneath its
directory. Its `README.md` is then removed with the empty plan directory.

The README never moves into observed because it describes temporary future
intent rather than implemented architecture. Git history retains the original
plan, every intermediate state, and the commit where the plan disappeared.

There is no completed-plan archive or separate lifecycle metadata.

## Display model

Groma composes a selected plan with the architecture at a selected revision.
Observed elements provide the implemented foundation; remaining plan elements
show the desired additions or changes. Moving through commits shows planned
Markdown materializing into observed architecture.

Git is the source of revision order and identity. Commits that do not change
architecture may produce the same architecture model without requiring special
handling.

## First-contract boundaries

This contract defines planned additions and changes represented by architecture
Markdown. It does not yet define planned removal syntax, concurrent plans that
change the same element, or non-Git revision providers. Those behaviors require
an approved example before design or implementation.

This document also does not migrate the existing cumulative plan directories,
rewrite the public glossary, or change the reader, validator, comparison model,
or viewers. Those are subsequent implementation decisions after this contract
is reviewed.
