# The Groma Manifesto

Groma is a living, Git-native, C4-compatible architecture model compiled from
Markdown, continuously reconciled with code, and animated as agents change the
system. It stores architecture, not diagrams.

The Markdown must remain useful even if Groma disappears.

## The model

- One C4 element per Markdown file: person, system, container, or component.
  Frontmatter carries the stable identity (`id`, `kind`, `parent`, `external`);
  the body explains the element and its outgoing relationships to a reader.
- Elements are matched by stable ID. Paths make the architecture browsable;
  frontmatter is authoritative.
- Approved hand-authored Markdown and its rendered view are the semantic
  authority. The scanner exists to reproduce that meaning from code: files,
  directories, and imports are evidence, not architecture.

## Observed, plans, revisions

- **Observed architecture** (`groma/observed/`) is the architecture currently
  known to exist: the only authored complete state.
- **A plan** (`groma/plans/<feature>/`) is one independent desired feature: a
  README plus only the element Markdown not yet implemented, at paths mirroring
  their eventual place under observed. A plan is a partial overlay, not a
  complete model and not a cumulative step. Plans do not build on each other
  and have no order.
- **A revision** is the immutable architecture state a Git commit represents.
  Revisions are never stored as directories, and Groma records no
  plan-to-revision mapping.

## The lifecycle

Implementation is a file move:

```text
groma/plans/<feature>/<element>.md
                ↓ implemented
groma/observed/<element>.md
```

- A planned change to an existing element is the desired version at the same
  relative path; implementing it replaces the observed file and removes it
  from the plan in the same commit.
- The plan drains as work lands, so its remaining content is its progress.
- A plan with no element Markdown left is complete: its README and directory
  are deleted. The README never moves into observed.
- There is no archive folder, status field, lock file, or lifecycle metadata.
  Git history retains every plan, its progression, and its completion.

## Display

Groma composes a selected plan with observed architecture and derives their
differences; the Markdown stores no comparison state. Observed elements are
the implemented foundation, remaining plan elements are the desired additions
and changes, and moving through revisions shows planned Markdown
materializing into observed architecture.

## Boundaries

Groma is not:

- a diagram store or a source-code browser;
- a task manager: Backlog.md coordinates the implementation work between
  architectural states;
- a plan executor: plans describe outcomes, never implementation steps;
- dependent on any hosted service.

Deliberately undefined until an approved example requires them: planned
removal syntax, concurrent plans changing the same element, and non-Git
revision providers.

If a proposed change conflicts with this manifesto, surface the conflict and
request an explicit product decision.
