# Product model

Groma is this repository's architecture, stored as ordinary Markdown and shown
as one C4 world. Solid boxes exist. Ghosts are next. A generated picture of
the same repo is already out of date.

The architecture model owns identity. Source code is evidence. Groma is the
only writer of architecture element and revision files. The project owner
controls the project title, optional concise description, and long overview in
`groma/project.md`, directly or through the web map. The
[architecture Markdown contract](component-markdown.md) defines the strict OKF
v0.2 Groma profile.

## What you do

People and agents use Groma. They do not edit architecture element or revision
Markdown by hand. Groma writes those files so paths, identity, and metadata
stay consistent. The root `groma/project.md` is different: standard `title` and
optional `description` fields are frontmatter, while its normal Markdown body
is the complete project overview. Bare `groma` opens a terminal launcher for
the current repository: Up and Down choose an executable action, Instructions,
or the Advanced commands row. Enter runs an action, opens
Instructions, or toggles Advanced commands. The expanded advanced commands are
read-only syntax references: `<name>` is required, `[option]` is optional, and
`…` means more options. Instructions uses the same logo and repository context,
selects Overview by default, and shows each shipped guide below its guide table.
Up and Down choose a guide. J and K scroll its content one line; Page Up and
Page Down move one page. Backspace or the Back row returns to the launcher.
Bare `groma instructions` opens this screen on a TTY. Named guides,
non-interactive use, and `--plain` remain plain text. This catalog is for
people. `groma agent-instructions [guide]` is a separate, always-plain catalog
of agent operating rules; `curation` is its default guide. Every shipped guide
points readers to both catalogs.

`groma init` is the explicit repository-registration action for coding agents.
It reconciles one short managed Groma block in each distinct root `AGENTS.md`
or `CLAUDE.md` that already exists. If neither exists, it creates only
`AGENTS.md`. Files that resolve to the same target through a symlink are written
once, the symlink and surrounding instructions remain unchanged, and repeated
runs keep one block. No other command performs this reconciliation; in
particular, `groma web` remains a scan-and-view action.

1. Open a viewer: see the world. `groma web` scans the repository and starts
   the browser map. On a TTY, `groma view` scans and starts the terminal map.
   Each live process then starts the same watch as `groma scan --watch`, so a
   later source change folds and the map updates. An architecture Markdown
   change reloads the world without scanning. `groma view --plain`, or `groma
   view` when stdout is not a TTY, prints the merged world as plain text
   without scanning and does not start the TUI.
   `groma view <id|plan|file>` prints one record as plain text: an
   element, a plan, or the element whose `groma.code` names that
   repository-relative file. When several elements share the file, the
   command fails.
2. Publish a snapshot with `groma export <directory>`. The generated static
   site contains the current project profile, architecture map and flows,
   mapped Backlog work with task details and diffs, and architecture-owned
   source inspection. It has no editor and never reads the repository or a
   running Groma server. Everything in the output directory is public data.
   `--watch` replaces the static snapshot after supported source,
   architecture Markdown, or Backlog changes; an open page adopts each
   replacement without reloading. Hosting and access control belong to the
   chosen static host, outside Groma.
3. `groma scan`: scan this repo. Core folds the findings into Markdown.
   The command prints `ok` and a short summary. It does not print the
   architecture.
4. Change the architecture through Groma's commands; no viewer edits element
   or revision documents.
   - A **new part** becomes a ghost in a plan. `groma create` authors that
     ghost.
   - A **required change** to an existing part becomes a plan that restates
     that ID, so the same box shows work still to do. `groma edit
     <element-id> --plan <plan-id>` restates that ID.
   - An **explanation** of an existing part (notes that describe it without
     changing it) stays on the observed document. `groma edit
     <element-id> --overview <markdown>` updates that leading body prose.
     `groma edit <plan-id> --overview <markdown>` sets the plan Outcome. The
     optional concise OKF field is changed separately with `--description`.
   - A **known existing part** that has no source evidence is authored with
     `groma create <name> --observed`.
   - Atomic scan evidence is curated with `groma edit`: combine empty scan
     records, move an empty scanned component, and group or ungroup sibling
     components. These operations validate the whole change before writing.
   - An observed collaboration is authored with `groma relate <source-id>
     <target-id> --description <prose> --technology <text>` and removed with
     the same command plus `--remove`.
   - The web map's project pencil edits only the project title, concise
     description, and body overview in `groma/project.md`; it does not edit C4
     concepts.
5. `groma accept <id>`: accept that ghost, only if a scan has matched it.
   Groma may scan first if needed. No match: the command fails and the
   ghost stays planned. A scan never accepts a ghost on its own.

An architect who only wants to see the repo uses 1 and 3. A builder adding
parts from elsewhere asks Groma to put them in a plan, then uses 1 and 5.
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
`groma/observed/`. It may be empty. Groma writes it from direct observed
creation, a scan, accepted plans, and curation people apply through Groma.

After the first write of a document, later scans may refresh only nested
`groma.code` frontmatter. They do not rewrite explanations, unowned metadata,
or other authored prose.

`groma.technology`, a free-text value with comma-separated parts, is authored
through Groma. Core reads it and both details panes show it under How it's
built. Only a system may have `groma.external: true`.

## Scanning

`groma scan` runs once and exits. From the user's point of view it succeeds
with `ok` and a short summary of what changed. It does not print elements,
IDs, or a machine-readable architecture. If someone later needs that, it is
a different command, not scan.

`groma scan --watch` is the same scan, left running. It watches supported
TypeScript and C# source and project files. It does not open a viewer. `groma
view` and `groma web` run one scan before opening, then start that watch
in-process.

Each language scanner returns one validated, complete observation of atomic
files and symbols, inferred scopes and relationships, and diagnostics. Groma
collects every supported observation before core writes Markdown. A scanner
failure therefore cannot publish a partial batch.

Core applies the batch like this:

1. An existing `groma.code` file match keeps its element and authored body. Symbols
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
directory. The directory name is its immutable kebab-case ID; the reserved
`index.md` contains its readable context and optional Outcome. The directory
holds only C4 concepts that are not yet accepted. When none remain, the plan is
complete; its index stays as the record.

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
document. Groma writes the matching `groma.code`, updates paths and metadata,
and removes the planned file. Implementation still happens in source. Accept
does not invent evidence or human verification.

## One world

Core is the only runtime that reads architecture Markdown. It loads every C4
element document under `groma/observed/`, under `groma/missing/`, and in
every plan directory under `groma/plans/`, merges them into one world, and
lays that world out before any viewer sees it: `world-layout` gives the TUI
map its bounds and routes, the `sheet` gives the web map its cells, floors
and lanes. A viewer plugin projects what core computed. It never reads the
files itself. The package requires `groma/index.md` with only the OKF v0.2
declaration and `groma/project.md` with the explicit Groma architecture marker.
Revision context lives in `groma/observed/index.md`, `groma/missing/index.md`,
`groma/plans/index.md`, and each plan's `index.md`.

Core also counts the lines of each element's `groma.code` files; an unreadable
file counts 0. In the web map, every source file belongs to one visible floor
group. Component file counts map project-relative from one to five floors, so
the component with the fewest files has one floor and the component with the
most has five. Each group takes the maximum member LOC, dependent, and
dependency measurement. Groups are ordered largest-first and lower footprints
expand where needed so no upper floor overhangs them. `heightUnits` range from
one to four, width shows dependents, and depth shows dependencies. Floors stay
centred on one tower axis, and facade patterns come from normalized file
extensions. The
terminal details pane keeps the aggregate count as `N files · ~M lines`.

A reserved index is not an element. Other typed OKF concepts may coexist in a
marked package, but only the four exact C4 types enter Groma's architecture
world. A generic OKF package without the Groma project marker is rejected.

Parents resolve by `id` across this merged world. A relationship target is
the element whose document the row's link reaches; a link that does not
reach an element document is an error.

A software-to-software relationship is authored on the lowest elements that
exist: components, once they exist. Parents are connected because a child
is. Do not also write that collaboration on a parent. An actor-to-system
relationship, and a parent row with no lower pin yet, stay as written.
Viewers treat an authored A → B as also connecting exclusive ancestors of
A and B. Layout keeps one route per authored relationship.

Runtime origin annotations are derived from location. They are distinct from
the standard top-level lifecycle `status`, which is `draft` for planned
representations and `stable` for observed, missing, and accepted ones:

- `observed`: the ID lives under `groma/observed/`
- `planned`: the ID lives in a plan
- `missing`: the ID lives under `groma/missing/`, a third revision whose
  elements draw dotted

`groma view --plain` prints one element per ID and prefers the planned
representation over the observed one, and the observed over the missing.

Git is history. Walking commits shows observed documents appearing and
changing as ghosts are accepted.

## Work

The embedded Backlog work-source plugin reads through the global `backlog` CLI:
the configured statuses and
default status plus one `task list --json` summary containing every configured
task, including terminal history. It reads `task view <id> --json` only for the
task whose full details a developer opens. The last configured status is
terminal. Groma watches `backlog/tasks` and never writes a task. A task touches
every element whose `groma.code` maps one of its modified files, then every element
it references by exact `id`. The terminal map marks the assignees of each task
In Progress on those elements. The web map stands one pin per assignee and task
on the element the task touched last; an unassigned mapped task gets one generic
Backlog pin. The Live work island filters pins and chips by the configured
statuses, showing a filter only while that status has a mapped pin. A filter
appears when the first matching pin arrives. The default and terminal statuses
start hidden and every other configured status starts shown. Without the CLI,
the plugin supplies empty work and every architecture flow remains available.
