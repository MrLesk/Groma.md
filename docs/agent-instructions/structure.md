# Curating structure

Structure decides which elements exist, where each belongs, and which source
files each component owns. Settle it before writing meaning: combines and moves
refuse records that already carry authored meaning.

Scans create the stable systems, containers, and components of existing
software. Hand-proposed software stays a ghost draft until a scan matches it
and it is accepted. Actors and external systems are stable declarations of what
the scanner cannot see.

## Order of work

1. Exclude development and test tooling that is not product architecture.
2. Settle container boundaries. Read each container's source files and identify
   the application or data store it represents.
3. Combine files that implement one responsibility into skyscrapers, detach
   files that belong elsewhere, and move components that belong under another
   container.
4. Group independently meaningful sibling components by domain.
5. Declare the people and outside systems the scan cannot see.
6. Curate one system or container at a time and review the rendered map.

## Commands

| Command | Targets |
| --- | --- |
| `groma edit <survivor> --combine <absorbed...>` | IDs of scanned systems, containers, or components with the same kind and parent |
| `groma edit <component> --parent <container>` | a scanned component ID and a container ID |
| `groma edit <container> --parent <system>` | a scanned container ID and a system ID |
| `groma edit <component> --detach <file...>` | a component ID and exact repository-relative files it owns |
| `groma edit <component> --group <name>` or `--ungroup` | a component ID; the group name is free text |
| `groma add group <name> <component...>` | sibling component IDs |
| `groma edit group <address> --title <text>` | a group address |
| `groma remove group <address> [component...]` | a group address, and the IDs of the members that leave; without members the group dissolves |
| `groma add actor <name> --overview <markdown>` | the name of a new person |
| `groma add external <name> --overview <markdown>` | the name of a new outside system; `--technology` is optional |
| `groma draft <system\|container\|component> <name> --parent <id>` | a new name and its parent element ID |
| `groma accept <id>` | a ghost element ID; scans first when no scan has matched it yet |
| `groma remove <id>` | an actor, external system, ghost, or unused draft ID, or a scanned component without Code references |

A group address is `<container-id>/<group-kebab>`; it is not an element ID. A
ghost is written at the path it will keep. To remove a scanned component,
delete its source files and run `groma scan` first. Removal refuses while
flows, incoming relationships, or children depend on the element.

These commands validate the complete change before writing. Do not edit
architecture Markdown with generic file tools. Combine, detach, move, group,
ungroup, and group add, rename, or removal are structural commands: they print the paths
and IDs they changed, which `groma agent-instructions backlog` explains how to
record.

## Development and test tooling

Tests, fixtures, build scripts, and other development tooling are not product
architecture unless the human says so. Exclude them before curating: add Git
ignore patterns to the `exclude` array in `<groma-root>/scanners.json`, keep its
existing `scanners` entries, and run `groma scan`.

```json
"exclude": ["/scripts/", "/test/", "**/*.spec.ts"]
```

`scanners.json` is scanner configuration, not architecture Markdown, so edit it
directly. Patterns are relative to the repository root and use `/` separators;
a leading `/` matches only at the root. Excluded files do not become new
components. Components already stored for newly excluded files keep their Code
references; report them to the human.

## Container combines

Suppose a scan placed parts of one local command-line application in two
sibling containers, `runtime` and `commands`. After reading their source, you
confirm that they run as one application. Keep `runtime` and absorb `commands`:

```sh
groma view runtime
groma view commands
# Read every listed source file and each child record before combining.
groma edit runtime --combine commands
groma view runtime
```

The `runtime` ID survives. Each component under `commands` keeps its own ID
and Code references, but its parent becomes `runtime` and its architecture
file moves under that container. The `commands` record is removed. A component
combine instead collects the absorbed components' Code references on the
surviving component.

Combined records must have the same kind and parent. Absorbed records cannot
have body content, concept-addressed relationships, a group, or technology.
The children a combine absorbs directly cannot have body content either, so a
system combine refuses a described container while a described component two
levels down relocates with it. A move requires an empty body on the record that
moves, not on its children. No record anywhere under a moved or absorbed record
may hold a concept-addressed relationship, because its document changes path.
File connections follow their current owners and do not block these operations.
The survivor may already have authored meaning.

## Splits and single-file moves

Detach takes files out of a component that should not own them. The component
keeps its ID and meaning, and its other files. The next scan gives each
detached file its own new component in the container the scanner infers, and
combine or move then places it:

```sh
groma edit reports --detach src/reports/security.ts
groma scan
groma view src/reports/security.ts
# Combine the printed owner into the component that should own the file.
groma edit security --combine <printed-owner-id>
```

Detach refuses a file the component does not own and writes nothing. It also
refuses a file whose relationship a flow step uses. Detach and combine are
separate edits. File relationships stay stored while a file has no owner and
follow the new owner after the scan.

Detaching every file leaves an empty component that keeps its ID and meaning.
Combine the new component back into it after the scan, or remove the emptied
component before scanning.

A scanner may declare several files as one source unit, such as a component
and its template. A scan returns a detached member to the owner of the rest of
its unit. Detach every file of the unit to give the unit one new component.

Do not clear authored meaning or edit architecture files to bypass a refused
combine or move.

## One product, several scanned systems

A scan creates one system per project it finds, so a repository with several
languages or applications can start with several systems. Keep them when they
describe separate products. When they describe one product, merge them:

```sh
groma edit shop --combine depot
```

Every container of `depot` moves under `shop` with its components, keeping its
ID, Code references, and meaning, and the `depot` record is removed. Move a
single container instead when only part of a system belongs elsewhere:

```sh
groma edit depot-warehouse --parent shop
```

A container carries its components to the new system. A system emptied this way
stays until you combine it into the surviving system. Both operations refuse a
container or system with authored meaning under the same rules as component
moves and combines, refuse an external system as a destination, and refuse a
change that would leave a flow step unresolvable.

## Skyscrapers

A skyscraper is one component with several Code references. Combine files when
all of these are true:

- One clear sentence describes their shared responsibility.
- They have the same architecture parent.
- Their collaboration is internal implementation detail.
- They normally change for the same product reason.
- Other components need the combined responsibility, not the individual
  helper files.

Keep a file in a separate component when it has its own responsibility,
collaborations, lifecycle, or reason to change. A shared cross-domain operation
should remain independent even when merging it would reduce the component
count. File size does not decide this: a small entry point may own a large
responsibility, and a large file may still be only one part of a component.

## Groups

A group is a named domain containing independently meaningful sibling
components. Use a group when the components share one parent and belong to one
area of the product, but each still deserves its own name, responsibility, and
Code list. A skyscraper may also be a member of a group.

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

- One source file has at most one component owner; it may have many users.
- A shared responsibility remains independent instead of being folded into its
  most frequent caller.
- Existing IDs, descriptions, relationships, and truthful ownership survive
  curation.
- Tests, generated files, experiments, and temporary probes do not become
  file-shaped product components merely because the scanner sees them.
- The goal is the fewest truthful components, not the lowest possible count.

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

The structure is complete when:

- Two consecutive runs of `groma scan` create no component for an already owned
  file, and curated groups and multi-file Code lists remain unchanged.
- Every supported source file has at most one component owner.
- The How-it-is-built view shows the expected exact files.
- The rendered map makes the major domains easier to find, and the human agrees
  that it describes the project rather than its directory tree.

Reducing the component count is useful evidence, but it is not an acceptance
criterion. A review may restore a component when combining it made the
architecture less truthful.
