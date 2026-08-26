# Product model

Groma is this repository's architecture, stored as ordinary Markdown and shown
as one C4 world. Solid boxes exist. Ghosts are next. A generated picture of
the same repo is already out of date.

The architecture model owns identity. Source code is evidence. Groma is the
only writer of architecture element and revision files. The project owner
controls the project name and description in `groma/README.md`, directly or
through the web map. The [component Markdown contract](component-markdown.md)
defines the architecture document format.

## What you do

People and agents use Groma. They do not edit architecture element or revision
Markdown by hand. Groma writes those files so paths, identity, and metadata
stay consistent. The root `groma/README.md` is different: its H1 is the project
name and the remaining Markdown body is the project description. Bare `groma` and `groma
instructions` are the local instruction hub.

1. Open a viewer: see the world. On a TTY, `groma view` starts the TUI
   plugin. It does not scan on open. The live process starts the same
   watch as `groma scan --watch`, so a later source change folds and the
   map updates. An architecture Markdown change reloads the world without
   scanning. `groma view --plain`, or `groma view` when stdout is not a
   TTY, prints the merged world as plain text and does not start the TUI.
   `groma view <id|plan|file>` prints one record as plain text: an
   element, a plan, or the element whose `code` names that
   repository-relative file. When several elements share the file, the
   command fails.
2. `groma scan`: scan this repo. Core folds the findings into Markdown.
   The command prints `ok` and a short summary. It does not print the
   architecture.
3. Change the architecture through Groma's commands; no viewer edits element
   or revision documents.
   - A **new part** becomes a ghost in a plan. `groma create` authors that
     ghost.
   - A **required change** to an existing part becomes a plan that restates
     that ID, so the same box shows work still to do. `groma edit
     <element-id> --plan <plan-id>` restates that ID.
   - An **explanation** of an existing part (notes that describe it without
     changing it) stays on the observed document. `groma edit
     <element-id> --description <prose>` updates that lead prose.
     `groma edit <plan-id> --description <prose>` sets the plan Outcome.
   - The web map's project pencil edits only the project name and description
     in `groma/README.md`; it does not edit architecture.
4. `groma accept <id>`: accept that ghost, only if a scan has matched it.
   Groma may scan first if needed. No match: the command fails and the
   ghost stays planned. A scan never accepts a ghost on its own.

An architect who only wants to see the repo uses 1 and 2. A builder adding
parts from elsewhere asks Groma to put them in a plan, then uses 1 and 4.
An expert or agent uses the same commands, including from an empty world.

## Identity

An architecture ID is a stable lowercase kebab-case name in Markdown. Groma
does not put architecture IDs in application source.

The merged world keys each element by representation: `observed:<id>` for
an observed document, `planned:<plan>:<id>` for a planned one. An ID that
a plan restates therefore has two representations. The maps draw the
observed box solid and the planned one as a ghost; `groma view --plain`
prints the planned one.

- Observed IDs are solid.
- A new planned element receives its ID when Groma authors the plan. That is
  the ID it will keep when accepted.
- A required change to something that exists restates that same ID and
  shows as a ghost until accepted.
- Core assigns an ID only when a scan finds an unknown file, derived from its
  recognizable file name and qualified when the world already uses that ID.
- A scanner never invents an ID for a ghost and never decides that a ghost is
  built.

## Observed architecture

Observed architecture is what is known to exist. It lives under
`groma/observed/`. It may be empty. Groma writes it from a first scan, from
accepted plans, and from explanations people add through Groma.

After the first write of a document, later scans may refresh only `code`
frontmatter. They do not rewrite explanations or other authored prose.

`technology`, a free-text frontmatter line with comma-separated parts, is
authored the same way. Core reads it and both details panes show it under
How it's built.

## Scanning

`groma scan` runs once and exits. From the user's point of view it succeeds
with `ok` and a short summary of what changed. It does not print elements,
IDs, or a machine-readable architecture. If someone later needs that, it is
a different command, not scan.

`groma scan --watch` is the same scan, left running. It watches supported
TypeScript and C# source and project files. It does not open a viewer.
`groma view` and `groma web` start that watch in-process.

Each language scanner returns one validated, complete observation of atomic
files and symbols, inferred scopes and relationships, and diagnostics. Groma
collects every supported observation before core writes Markdown. A scanner
failure therefore cannot publish a partial batch.

Core applies the batch like this:

1. An existing `code` file match keeps its element and authored body. Symbols
   refresh from current evidence, but every curated file remains on that
   element, including files grouped together by a person.
2. Placement inferred from imports, directories, or projects chooses a scope
   for unknown files. It never changes existing ownership.
3. An unknown file becomes a singleton component. A matching ghost receives
   Code and remains planned.

A scan never turns a ghost into observed architecture.

## Plans

A plan is a fragment of desired architecture, not a second complete system.
It lives under `groma/plans/<plan-id>/`. Groma creates and updates that
directory. The plan README declares an immutable kebab-case ID. The directory
holds only element documents that are not yet accepted. When none remain, the
plan is complete; its README stays as the record.

A plan describes outcomes and requirements. It does not specify frameworks,
file layouts, or other implementation detail unless a requirement forces it.

Parents resolve in the merged world. A planned component may name an observed
container as `parent` without copying that container into the plan.

Two plans must not claim the same element ID. Groma keeps that true when it
writes files. Core does not check this on load.

`groma accept <id>` succeeds only when a scan has matched that ID: either
a scan you already ran, or a scan Groma runs as part of accept. No match:
accept fails and the ghost stays a ghost.

On success, Groma applies the planned document to observed architecture: a
new ID becomes observed; a restated ID updates the existing observed
document. Groma writes the matching `code`, updates paths and metadata, and
removes the planned file. Implementation still happens in source. Accept
does not invent evidence.

## One world

Core is the only runtime that reads architecture Markdown. It loads every C4
element document under `groma/observed/`, under `groma/missing/`, and in
every plan directory under `groma/plans/`, merges them into one world, and
lays that world out before any viewer sees it: `world-layout` gives the TUI
map its bounds and routes, the `sheet` gives the web map its cells, floors
and lanes. A viewer plugin projects what core computed. It never reads the
files itself. The minimum tree is `groma/README.md`, `groma/observed/README.md`,
`groma/missing/README.md`, and the `groma/plans/` directory.

Core also counts the lines of each element's `code` files; an unreadable
file counts 0. In the web map, every unique file becomes one building
section from one to four floors according to its share of the observed
project's file-line range. Four or more sections align as one tower, while
two or three retain visible setbacks. A section's facade pattern comes from
its normalized file extension. The terminal details pane keeps the aggregate
count as `N files · ~M lines`.

A plan README is not an element. Other prose without C4 frontmatter is not an
element.

Parents resolve by `id` across this merged world. A relationship target is
the element whose document the row's link reaches; a link that does not
reach an element document is an error.

A software-to-software relationship is authored on the lowest elements that
exist: components, once they exist. Parents are connected because a child
is. Do not also write that collaboration on a parent. An actor-to-system
relationship, and a parent row with no lower pin yet, stay as written.
Viewers treat an authored A → B as also connecting exclusive ancestors of
A and B. Layout keeps one route per authored relationship.

Runtime annotations are derived from location and are never written into
frontmatter:

- `observed`: the ID lives under `groma/observed/`
- `planned`: the ID lives in a plan
- `missing`: the ID lives under `groma/missing/`, a third revision whose
  elements draw dotted

`groma view --plain` prints one element per ID and prefers the planned
representation over the observed one, and the observed over the missing.

Git is history. Walking commits shows observed documents appearing and
changing as ghosts are accepted.

## Work

Groma reads Backlog through the `backlog` CLI: the configured statuses and
default status, `task list --json`, then `task view <id> --json` for every
nonterminal task and each terminal task changed within the last 24 hours.
The last configured status is terminal. Groma watches `backlog/tasks` and
never writes a task. The terminal map marks the assignees of each task In
Progress on every element the task references by exact `id`. The web map
stands one pin per assignee and task on the element the task touched last:
the element whose `code` holds the task's newest modified file, else the
first element it references. An unassigned mapped task gets one generic
Backlog pin. The Live work island filters pins and chips by the configured
statuses, showing a filter only while that status has a mapped pin. A filter
appears when the first matching pin arrives. The default and terminal
statuses start hidden and every other configured status starts shown.
