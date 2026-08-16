# Product model

Groma is this repository's architecture, stored as ordinary Markdown and shown
as one C4 world. Solid boxes exist. Ghosts are next. A generated picture of
the same repo is already out of date.

The architecture model owns identity. Source code is evidence. Groma is the
only writer of files under `groma/`. The [component Markdown
contract](../groma/README.md) defines the document format.

## What you do

People and agents use Groma. They do not edit `groma/` Markdown by hand.
Groma writes those files so paths, identity, and metadata stay consistent.

1. Open a viewer — see the world. `groma view` starts the TUI plugin. It
   does not scan.
2. `groma scan` — scan this repo. Core folds the findings into Markdown.
   The command prints `ok` and a short summary. It does not print the
   architecture.
3. Change the architecture through Groma, in the viewer or the CLI.
   - A **new part** becomes a ghost in a plan.
   - A **required change** to an existing part becomes a plan that restates
     that ID, so the same box shows work still to do.
   - An **explanation** of an existing part — notes that describe it without
     changing it — stays on the observed document.
4. `groma accept <id>` — accept that ghost, only if a scan has matched it.
   Groma may scan first if needed. No match: the command fails and the
   ghost stays planned. A scan never accepts a ghost on its own.

An architect who only wants to see the repo uses 1 and 2. A builder adding
parts from elsewhere asks Groma to put them in a plan, then uses 1 and 4.
An expert or agent uses the same commands, including from an empty world.

## Identity

An architecture ID is a stable lowercase kebab-case name in Markdown. Groma
does not put architecture IDs in application source.

The merged world allows one element per ID.

- Observed IDs are solid.
- A new planned element receives its ID when Groma authors the plan. That is
  the ID it will keep when accepted.
- A required change to something that exists restates that same ID. The box
  stays one box and shows as planned until accepted.
- Core assigns an ID only when a scan finds something that is not already in
  the world, derived from the candidate's recognizable name.
- A scanner never invents an ID for a ghost and never decides that a ghost is
  built.

## Observed architecture

Observed architecture is what is known to exist. It lives under
`groma/observed/`. It may be empty. Groma writes it from a first scan, from
accepted plans, and from explanations people add through Groma.

After the first write of a document, later scans may refresh only `code`
frontmatter. They do not rewrite explanations or other authored prose.

## Scanning

`groma scan` runs once and exits. From the user's point of view it succeeds
with `ok` and a short summary of what changed. It does not print elements,
IDs, or a machine-readable architecture. If someone later needs that, it is
a different command, not scan.

The scanner plugin sends candidates to Groma core: names, responsibilities,
containment evidence, relationships, and Code references, and no architecture
IDs. Core folds that result into Markdown.

Core applies a candidate like this:

1. An existing `code` reference that still matches keeps that element's ID.
   Core refreshes `code` and leaves the body alone.
2. Else the kebab-case of the candidate name equals an existing ID. Observed
   match: refresh `code`, keep the body. Ghost match: attach `code` to the
   planned document. The ID stays planned.
3. Else Groma creates a new observed file with that ID.

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
writes files.

`groma accept <id>` succeeds only when a scan has matched that ID — either
a scan you already ran, or a scan Groma runs as part of accept. No match:
accept fails and the ghost stays a ghost.

On success, Groma applies the planned document to observed architecture: a
new ID becomes observed; a restated ID updates the existing observed
document. Groma writes the matching `code`, updates paths and metadata, and
removes the planned file. Implementation still happens in source. Accept
does not invent evidence.

## One world

Core is the only runtime that reads architecture Markdown. It loads every C4
element document under `groma/observed/` and every plan, merges them into one
world, and lays that world out once. A viewer plugin projects that world. It
never reads the files itself.

A plan README is not an element. Other prose without C4 frontmatter is not an
element.

Parents and relationship targets resolve by `id` across this merged world. The
Markdown link is for readers, not identity.

A software-to-software relationship is authored on the lowest elements that
exist — components, once they exist. Parents are connected because a child
is. Do not also write that collaboration on a parent. A person-to-system
relationship, and a parent row with no lower pin yet, stay as written.
Viewers treat an authored A → B as also connecting exclusive ancestors of
A and B. Layout keeps one route per authored relationship.

Runtime annotations are derived from location and are never written into
frontmatter:

- `observed` — the ID lives under `groma/observed/`
- `planned` — the ID lives in a plan

A plan that restates an observed ID wins for that box until it is accepted.

Git is history. Walking commits shows observed documents appearing and
changing as ghosts are accepted.
