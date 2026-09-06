# Curating a scanned architecture

When a human asks for an architecture diagram of an unfamiliar project, treat
the scanner's first result as evidence, not as the finished architecture.
Run the scan before inventing components, then read the code and turn its
file-shaped output into responsibilities a person can recognize.

The scanner deliberately reports atomic files, symbols, projects, imports,
and inferred placement. It cannot decide the architectural meaning of those
facts. Semantic curation belongs to the agent and human using Groma.

Scanners return temporary source and operation evidence. Core applies the
[shared inference rule](../relationship-inference.md#current-inference-rule)
and writes selected interactions under `Derived relationships` in
`relationships.md`. It does not persist raw dependency graphs or put every
used import on the map. The first rule covers concretely supplied named
callbacks; ordinary calls and unresolved wiring need further interpretation.
Each file has one owner in the current profile, and many possible users.

Authored code interactions name exact source files in `relationships.md`,
including interactions such as HTTP with no import between the files.
Actor and external-system declarations may use concept IDs. Current authored
text takes precedence for the same file pair; editing a derived row takes
its authorship. Scans neither verify that text nor accept drafts. When a human
asks to inspect a fresh scan, stop before curation: do not add descriptions,
actors, flows, groups, or authored relationship rows.

## Backlog task links

When the `backlog` CLI is available and you work on a Backlog task, you must
keep its changed files and architecture references current. These links let
Groma place the task on the architecture map.

1. Read the task with `backlog task view <task-id> --plain` before changing code.
2. Immediately after changing a repository file, and before changing another
   file, record its repository-relative path in the task's modified-file list.
   `--modified-file` replaces the complete list: preserve every existing entry
   and append each newly changed path, using one flag per file in the order
   the files were first changed.
3. In that same update, add each affected architecture element's exact
   `groma.id` with `--add-ref`. Use `groma view <source-file>` to inspect the
   existing owner of a source file. Architecture references must use real element IDs;
   file paths, titles, and issue URLs do not identify map elements.

```bash
backlog task edit <task-id> \
  --modified-file <previous-path> \
  --modified-file <new-path> \
  --add-ref <groma-element-id>
```

Use Backlog's CLI to update the task; do not edit its Markdown directly.
Do not wait until testing or task completion to record these links.
Task metadata stays in Backlog. Groma uses file ownership and element IDs
to connect it to the map.

Structural commands (combine, move, group, ungroup, and group add, rename or
removal) report their completed writes after `ok` and the target ID or group
address. Each `created:`, `changed:`, or `removed:` line names a
repository-relative architecture path. Each `affected:` line names an element
whose document was written or removed. A `replaced: <absorbed-id> ->
<surviving-id>` line means a combine removed that element into the survivor.
Moves report both paths and keep the same ID. Groups report member IDs;
a group address is not an element ID.

Immediately after a multi-file structural command, before any further change,
record all its created, changed and removed paths in one Backlog update.
Preserve the complete existing modified-file list and append paths not already
recorded. Add the affected IDs that survive. For each replacement, remove the
absorbed ID from the task's references and add its surviving ID:

```bash
backlog task edit <task-id> \
  --modified-file <previous-path> \
  --modified-file <created-or-changed-path> \
  --modified-file <removed-path> \
  --add-ref <surviving-id> \
  --remove-ref <absorbed-id>
```

Repeat `--modified-file`, `--add-ref`, and `--remove-ref` as needed. Read the
task first if its current file list is not known. Groma returns the operation
facts; the agent updates Backlog through its CLI. These results are not saved
as ID aliases or operation history. Routine code work needs task links, not
a full scan and architecture curation cycle.

## Workflow

1. Confirm the repository root and the system the human wants to understand.
2. Run `groma scan`.
3. Read `groma view --plain` for the current inventory, then `groma view <id>`
   for a complete record and its Code references. `groma view <source-file>`
   resolves the same record by its exact repository-relative source path.
   Open the map with `groma web` or `groma view` to inspect the placement.
4. Read enough source to identify responsibilities, collaborations, and
   reasons to change. Directories, imports, and projects are useful evidence,
   but they are not the final architecture.
5. Settle container boundaries first. Read their source files and identify the
   applications and data stores they represent. Then combine files that
   implement one responsibility into skyscrapers. Complete moves and combines
   before adding meaning to records that must move or disappear.
6. Write the responsibilities and relationships, then group independently
   meaningful sibling components by domain. A skyscraper may also be a member
   of a group.
7. Apply the curation through Groma:
   - `groma add actor <name> --overview <markdown>` and `groma add external
     <name> --overview <markdown>` declare the people and outside systems the
     scan cannot see.
   - `groma draft <kind> <name> --parent <id>` drafts a system, container, or
     component that does not exist yet, as a ghost at the path it will keep.
     The scanner alone creates stable software.
   - `groma remove <id>` takes away a person, an external, a ghost, or a draft
     record; it refuses while something still depends on it and never removes
     scanned software.
   - `groma edit <id> --title <text>` renames an element or a draft record
     while its id stays; `--technology <text>` sets an element's technology
     and an empty value clears it. `groma edit project --title --description
     --overview` edits the project record.
   - `groma edit <target> --combine <source...>` folds empty scan records into
     one responsibility and preserves their unique Code references.
   - `groma edit <component> --parent <container>` moves empty scan evidence.
   - `groma edit <component> --group <name>` groups siblings; `--ungroup`
     clears the group. `groma add group <name> <ids...>` names several at
     once; the group is then addressed as `<container-id>/<group-kebab>` by
     `groma edit group <address> --title <text>` and `groma remove group
     <address> [ids...]`.
   - `groma draft relation <source> <target> --description <prose>
     --technology <text>` plans a link, even between existing components.
     `groma accept relation <source> <target>` explicitly makes it current;
     scans never accept it. Editing preserves the relationship lifecycle.
   - `groma add relation <source> <target> --description <prose> --technology
     <text>` writes one authored interaction per ordered endpoint pair; `groma edit relation
     <source> <target>` rewords it; `groma remove relation <source> <target>`
     removes it only while it is draft and no flow references it. Current
     relationships cannot be removed, including after explicit acceptance.
     For code-to-code interactions, `<source>` and `<target>` are exact source
     file paths, never component, container, or system IDs. Both files need
     owners. Scans refresh evidence without rewriting or verifying authored
     intent. Parents summarize the same claim; an aggregate path does not
     establish a runtime workflow.
   - `groma add flow <title> --overview <prose> --steps <markdown-table>`
     describes one scenario through existing relationships. Store From, To,
     and Action columns; link each endpoint to its C4 Markdown document.
     Choose the exact ordered steps the human needs to understand. Do not
     include every connection a component can reach. `groma edit <flow-id>`
     edits its meaning or steps, and `groma remove <flow-id>` removes it.
     The complete command example below explains endpoint paths and actor
     grouping. Run `groma agent-instructions curation` to read it from the CLI.
   These operations validate the complete change before writing. Do not edit
   Groma-owned architecture Markdown with generic file tools.
8. Run `groma scan` twice, then open the map again and review it with the human.

## Container combines

Suppose a scan placed parts of one local command-line application in two
sibling containers, `runtime` and `commands`. After reading their source,
you confirm that they run as one application. Keep `runtime` and absorb
`commands`:

```sh
groma view runtime
groma view commands
# Read every listed source file and each child record before combining.
groma edit runtime --combine commands
groma view runtime
```

The `runtime` ID survives. Each component under `commands` keeps its own ID
and Code references, but its parent becomes `runtime` and its architecture
file moves under that container. The `commands` record is removed. A
component combine instead collects the absorbed components' Code references
on the surviving component. Both operations report the paths and IDs needed
for the Backlog update above.

Combined records must have the same kind and parent. Absorbed records cannot
have body content, concept-addressed relationships, a group, or technology.
Children moved by a container combine cannot have body content or
concept-addressed relationships either. File connections follow their current
owners and do not block these operations. The survivor may already have
authored meaning. An individual component move likewise requires an empty
body and no concept-addressed relationships touching that component.

Read first, settle these boundaries, then write the affected responsibilities
and collaborations. If a mistaken combine needs a split or individual-file
reassignment, stop and report the exact current and intended owners: the CLI
does not currently provide that correction. Do not clear authored meaning or
edit architecture files directly to bypass the restriction.

## Description and overview

`--description` is an optional short summary, stored in the standard
`description` field of Open Knowledge Format (OKF). `--overview` is the fuller
explanation in the Markdown body. Ordinary Markdown and OKF readers can read
both; Groma uses them as the concept's summary and responsibility text.
Avoid repeating the same paragraph in both:

```sh
groma edit entry --description 'Request coordinator' \
  --overview 'Receives requests, validates their input, and dispatches work to the worker.'
```

For a relationship, `--description` instead states what the source does with
the target; `--technology` states how they interact.

## Flow command example

This example assumes these existing elements: actor `requester`, and
components `entry` and `worker` under container `api` in system `service`.
The directed relationships `requester -> entry` and `entry -> worker` must
already exist. Inspect their records with `groma view <id>` first; a flow
uses those collaborations and does not create them.

```sh
groma add flow 'Submit a request' \
  --overview 'The requester submits work; entry delegates it to the worker.' \
  --steps '| From | To | Action |
| --- | --- | --- |
| [Requester](../actors/requester.md) | [Entry](../systems/service/containers/api/components/entry.md) | Submit work |
| [Entry](../systems/service/containers/api/components/entry.md) | [Worker](../systems/service/containers/api/components/worker.md) | Process the request |'
groma view submit-a-request
```

Groma writes `<groma-root>/flows/submit-a-request.md`. All endpoint links
resolve relative to that flow document, not the shell's working directory.
Here `<groma-root>` is the project's selected `groma/` or `.groma/` directory;
the same `../actors/` and `../systems/` links work in either location.
Table order is execution order, and each row must match an existing directed
relationship. Choose only the steps that explain this scenario.

The browser groups a flow under the actor that starts its first step. This
flow therefore appears under Requester. In that actor's details, its flows
appear directly without repeating the actor heading. A flow is supporting
scenario knowledge over C4 relationships, not another C4 element or container.

## Scanner coverage

The embedded TypeScript scanner reads `.ts` and `.tsx` files selected through
Git's tracked and unignored untracked file inventory. Its default exclusions
are `test/**`, `test-bun/**`, declaration files (`*.d.ts`), and `*.test.ts`,
`*.test.tsx`, `*.spec.ts`, and `*.spec.tsx`. Test fixtures in other directories
and TypeScript build scripts can still be included. Inspect what was found
and describe development responsibilities separately when needed.

Markdown, HTML, CSS, JavaScript/CommonJS launchers, and shell scripts are not
covered by this scanner. `groma scanner list` lists scanner modules; the CLI
has no include/exclude editing helper. Do not assume an unsupported file has
been inspected or create a stable software component for it by hand. Report
the coverage gap. The optional C# scanner reads C# project evidence through
Roslyn and excludes generated `bin` and `obj` files.

Scanned files, symbols and placement are evidence. Agents annotate that
evidence with C4 responsibilities and collaborations; they do not change the
scan path. Hand-proposed systems, containers and components are drafts until
matched by a scan and explicitly accepted. Scans create stable records for
existing software. Actors and external systems are stable declarations of
things the source scanner cannot discover.

## Skyscrapers

A skyscraper is one component with several Code references. Combine files when
they implement one responsibility and selecting any file separately would add
no useful architectural meaning.

Combine files when all of these are true:

- One clear sentence describes their shared responsibility.
- They have the same architecture parent.
- Their collaboration is internal implementation detail.
- They normally change for the same product reason.
- Other components need the combined responsibility, not the individual
  helper files.

Keep a file in a separate component when it has its own responsibility,
collaborations, lifecycle, or reason to change. A shared cross-domain operation
should remain independent even when merging it would reduce the component
count.

File size does not decide this. A small entry point may own a large
responsibility, and a large file may still be only one part of a component.

## Groups

A group is a named domain containing independently meaningful sibling
components. Use a group when the components share one parent and belong to one
area of the product, but each still deserves its own name, responsibility, and
Code list.

Good groups explain the map, such as `Map painting`, `Navigation`, or `Scan
lifecycle`. Do not create a group merely because files share a directory. Do
not create a group of one component, and do not use a group to hide components
whose responsibilities are still unknown.

## Boundary checklist

For every candidate, ask:

1. What product responsibility requires this component to exist?
2. Would a human discuss or change it independently?
3. Does it own a collaboration another component depends on?
4. Is it shared across domains?
5. Is the proposed boundary based on meaning, or only on folders and imports?

If the first question has no answer, inspect more source before curating. Do
not keep blank placeholder components in a finished map. Also keep these
invariants:

- One source file has at most one component owner.
- A shared responsibility remains independent instead of being folded into
  its most frequent caller.
- Existing IDs, descriptions, relationships, and truthful ownership survive
  curation.
- Tests, generated files, experiments, and temporary probes do not become
  file-shaped product components merely because the scanner sees them.
- The goal is the fewest truthful components, not the lowest possible count.
- Curate one system or container at a time and inspect the rendered result.

## Example

A first scan may report these files as separate components:

```text
iso/map.ts
iso/paint-ground.ts
iso/paint-buildings.ts
iso/paint-routes.ts
iso/camera.ts
iso/project.ts
iso/blueprint.ts
```

After reading the code, a truthful result may be:

- **Iso map** skyscraper: `map.ts` and the three painting helpers.
- **Iso camera**: remains independent because it owns fit, pan, and zoom.
- **Iso projection** skyscraper: `project.ts` and `blueprint.ts` because both
  project the sheet into the rendered picture.
- **Map painting** group: contains Iso map, Iso camera, and Iso projection.

This is smaller than the scan output without erasing real responsibilities.

## Completion checks

The curation is complete when:

- Two consecutive scans create no component for an already owned file, and
  curated groups and multi-file Code lists remain unchanged.
- Every supported source file has at most one component owner.
- Every visible component has a responsibility a new reader can understand.
- The How-it-is-built view shows the expected exact files.
- The rendered map makes the major domains easier to find, and the human agrees
  that it describes the project rather than its directory tree.

Reducing the component count is useful evidence, but it is not an acceptance
criterion. A review may restore a component when combining it made the
architecture less truthful.

## More instructions

Run `groma instructions` for human guides and `groma agent-instructions` for
agent operating rules.
