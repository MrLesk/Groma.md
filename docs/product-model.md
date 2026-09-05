# Product model

Groma is this repository's architecture, stored as ordinary Markdown and shown
as one C4 world. Solid boxes exist. Ghosts are drafts. A generated picture of
the same repo is already out of date.

The architecture model owns identity. Source code is evidence. Groma is the
only writer of architecture element and draft files. The project owner
controls the project title, optional concise description, and long overview in
`groma/project.md`, directly or through the web map. The
[architecture Markdown contract](component-markdown.md) defines the strict OKF
v0.2 Groma profile.

## What you do

People and agents use Groma. They do not edit architecture element or draft
Markdown by hand. Groma writes those files so paths, identity, and metadata
stay consistent. The root `groma/project.md` is different: standard `title` and
optional `description` fields are frontmatter, while its normal Markdown body
is the complete project overview. Bare `groma` opens a terminal launcher for
the current repository: Up and Down choose an executable action, Instructions,
or the Advanced commands row. Enter runs an action or opens the selected screen.
The Advanced commands screen contains a read-only table with one concise
description beside each command: `<name>` is required, `[option]` is optional,
and `…` means more options. Up and Down select a command, the table keeps it
visible, and its explanation appears below the table. Tab switches between list
and reading focus. In reading focus, Up and Down scroll the explanation. J and K
scroll it one line in either focus; Page Up and Page Down move it one page. The repository
context, Back row, plugin readiness, and footer remain fixed. Commands stay
read-only. Enter returns from the selected Back row; Backspace always returns
with Advanced commands still selected.
Instructions uses the same logo and repository context,
selects Overview by default, and shows each shipped guide below its guide table.
Up and Down choose a guide in list focus. Tab switches to reading focus, where
arrows scroll content, and back to the guide list. J/K and page keys scroll in
either focus. The footer names the active focus. Backspace or the Back row
returns to the launcher, whose arrows continue to select actions.
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
runs keep one block. No other command performs this reconciliation on its
own; `groma web` reaches it only by offering `groma init` first in a
repository without Groma.

1. Open a viewer: see the world. `groma web` scans the repository and starts
   the browser map. On a TTY, `groma view` scans and starts the terminal map.
   Each live process then starts the same watch as `groma scan --watch`, so a
   later source change folds and the map updates. An architecture Markdown
   change reloads the world without scanning. `groma view --plain`, or `groma
   view` when stdout is not a TTY, prints the world as plain text without
   scanning and does not start the TUI.
   `groma view <id|draft|file>` prints one record as plain text: an
   element, a draft, or the element whose `groma.code` names that
   repository-relative file. When several elements share the file, the
   command fails.
   In a repository without a Groma directory, `groma web` on a TTY asks
   whether to run `groma init` first; yes runs the wizard for identity and
   storage, then `groma web` scans and opens the map, no prints one line
   naming `groma init` and exits cleanly. Without a TTY it prints one
   sentence naming `groma init` and fails, never with a stack trace. While
   the world has no elements, the browser map shows an invitation to scan or
   draft instead of empty ground; the [browser map](viewers/web/index.md)
   describes it.
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
   architecture. The scanner alone creates systems, containers, and
   components; nothing writes them by hand.
4. Change the architecture through Groma's commands; no viewer edits element
   or draft documents.
   - A **new part** is drafted. `groma draft <kind> <name> --parent <id>
     --overview <markdown>` writes a ghost at the path it will keep once
     accepted; the kind is system, container, or component. `--draft
     <draft-id>` files the ghost under a draft record.
   - A **part a draft touches** keeps its solid box and carries the tag:
     `groma edit <element-id> --draft <draft-id>`.
   - An **explanation** of an existing part (notes that describe it without
     changing it) stays on its document. `groma edit <element-id> --overview
     <markdown>` updates that leading body prose. `groma edit <draft-id>
     --overview <markdown>` sets the draft outcome. The optional concise OKF
     field is changed separately with `--description`. `--title` renames a
     part or a draft record while its id and file stay; `--technology` sets or
     clears an element's technology. In the web map the details pane edits
     title, description, overview and technology in place and tags the element
     with a draft; every field posts the input `groma edit` takes.
   - Atomic scan evidence is curated with `groma edit`: combine empty scan
     records, move an empty scanned component, and group or ungroup sibling
     components. These operations validate the whole change before writing.
   - A group is a name on each sibling component and is addressed as
     `<container-id>/<group-kebab>`: `groma add group <name> <ids...>` names
     it, `groma edit group <address> --title <text>` renames every member,
     `groma remove group <address> [ids...]` takes members out or dissolves
     it. In the web map a multi-selection of components offers Group as and
     Combine into (the person picks the survivor), and a pressed zone opens
     Rename and Dissolve.
   - A collaboration is authored with `groma add relation <source-id>
     <target-id> --description <prose> --technology <text>`, one per ordered
     pair on the source document; `groma edit relation <source-id> <target-id>`
     rewords it and `groma remove relation <source-id> <target-id>` removes it.
     In the web map, Relate to on a selected element takes the target from the
     next map click and asks for the sentence; a selected route edits its
     description and technology in place and ends with Remove.
   - **People and outside systems** are declared, never scanned: `groma add
     actor <name> --overview <markdown>` and `groma add external <name>
     [--technology <text>] --overview <markdown>` write them stable at once.
     `groma add draft <name> --overview <markdown>` writes a draft record.
     `groma add component <name>` refuses and names `groma draft`.
   - **Removing** takes the id alone: `groma remove <id>` deletes a person, an
     external, a ghost, or a draft record no ghost belongs to; it refuses and
     names what blocks it while other elements relate to the part, while a
     ghost still contains parts, or while ghosts still carry the draft's tag.
     Stable software is the scanner's: remove its code or combine it instead.
     Removing a draft record clears its tag from the stable parts it touched.
   - The project record is the reserved id `project`: `groma edit project
     --title <text> --description <text> --overview <markdown>` merges the
     given fields into `groma/project.md`. The web map's project pencil posts
     the same input.
5. `groma accept <id>`: accept that ghost, only if a scan has matched it.
   Groma may scan first if needed. No match: the command fails and the
   ghost stays a draft. A scan never accepts a ghost on its own. The file
   stays where it is; only its status changes.

An architect who only wants to see the repo uses 1 and 3. A builder adding
parts from elsewhere asks Groma to draft them, then uses 1 and 5.
An expert or agent uses the same commands, including from an empty world.

## Identity

An architecture ID is a stable lowercase kebab-case name in Markdown. Groma
does not put architecture IDs in application source.

Every element has one file for its whole life, and every ID is unique in the
tree. `groma view --plain` prints one element per ID.

- A drafted element receives its ID when Groma drafts it. That is the ID it
  keeps when accepted, in the same file.
- A part a draft touches keeps its ID and its file; the tag is the only
  change.
- Core assigns an ID only when a scan finds an unknown file, derived from its
  recognizable file name and qualified when the world already uses that ID.
- A scanner never invents an ID for a ghost and never decides that a ghost is
  built.

## The tree

The architecture is one tree under the Groma directory: `actors/` holds the
people who use the software, `externals/` the systems outside its boundary,
`systems/` the software itself with its containers and components, and
`drafts/` one record per draft. It may be empty. Groma writes it from scans,
accepted drafts, drafting, and the curation people apply through Groma. The
scanner alone creates stable systems, containers, and components.

After the first write of a document, later scans may refresh only nested
`groma.code` frontmatter. They do not rewrite explanations, unowned metadata,
or other authored prose.

`groma.technology`, a free-text value with comma-separated parts, is authored
through Groma. Core reads it and both details panes show it under How it's
built. Only a system may be external: it lives under `externals/` and has no
containers.

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
   Code and remains a draft.

A scan never turns a ghost into stable architecture.

## Drafts

A draft is an outcome people are drafting toward, not a second complete
system. Its record is `groma/drafts/<draft-id>.md`: the file name is its
immutable kebab-case ID, the frontmatter names it, and the body prose is the
outcome. The elements that belong to it carry `groma.draft: <draft-id>`. A
ghost is an element document with `status: draft`, stored at the path it will
keep. A stable element may carry the tag too: the draft touches it. A draft is
complete when no element carrying its tag is still a draft; its record stays.

A draft describes outcomes and requirements. It does not specify frameworks,
file layouts, or other implementation detail unless a requirement forces it.

Parents resolve in the one tree. A drafted component may name a stable
container as `parent`.

`groma accept <id>` succeeds only when a scan has matched that ID: either
a scan you already ran, or a scan Groma runs as part of accept. No match:
accept fails and the ghost stays a ghost.

On success, Groma changes the document's `status` to `stable` in the same
file and keeps its tag. Implementation still happens in source. Accept does
not invent evidence or human verification.

## One world

Core is the only runtime that reads architecture Markdown. It loads every C4
element document under the Groma directory and every draft record under
`drafts/`, merges them into one world, and composes one shared sheet before any
viewer sees it. The sheet gives both maps their surfaces, buildings, groups,
and route paths. Each viewer only projects those fixed cells for its own
screen. It never reads the architecture files or creates another world layout.
The package
requires `groma/index.md` with only the OKF v0.2 declaration and
`groma/project.md` with the explicit Groma architecture marker.

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

Parents resolve by `id` across the tree. A relationship target is the element
whose document the row's link reaches; a link that does not reach an element
document is an error.

A software-to-software relationship is authored on the lowest elements that
exist: components, once they exist. Parents are connected because a child
is. Do not also write that collaboration on a parent. An actor-to-system
relationship, and a parent row with no lower pin yet, stay as written.
Viewers treat an authored A → B as also connecting exclusive ancestors of
A and B. Layout keeps one route per authored relationship.

Runtime origin follows the standard top-level lifecycle `status` of the
document: `observed` for `stable`, `draft` for `draft`. Observed elements draw
solid, drafts draw dashed. A relationship has its own lifecycle: a row under Relationships is current,
and a row under Draft relationships is planned, independently of its endpoints.
Scans never accept planned links. Explicit acceptance moves the row into the
current table. Draft dashes stay fixed during selection and flow highlighting;
flow traversal uses a separate directional marker.

Git is history. Walking commits shows one file per element changing in place
as drafts are accepted.

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
