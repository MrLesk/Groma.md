# Curating a scanned architecture

When a human asks for an architecture diagram of an unfamiliar project, treat
the scanner's first result as evidence, not as the finished architecture.
Run the scan before inventing components, then read the code and turn its
file-shaped output into responsibilities a person can recognize.

The scanner deliberately reports atomic files, symbols, projects, imports,
and inferred placement. It cannot decide the architectural meaning of those
facts. Semantic curation belongs to the agent and human using Groma.

## Workflow

1. Confirm the repository root and the system the human wants to understand.
2. Run `groma scan`.
3. Open `groma web` or `groma view`, and inspect the generated components and
   their Code references.
4. Read enough source to identify responsibilities, collaborations, and
   reasons to change. Directories, imports, and projects are useful evidence,
   but they are not the final architecture.
5. First combine files that implement one responsibility into skyscrapers.
6. Then group the resulting independently meaningful sibling components by
   domain. A skyscraper may also be a member of a group.
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
     clears the group.
   - `groma add relation <source> <target> --description <prose> --technology
     <text>` writes the one collaboration per ordered pair; `groma edit relation
     <source> <target>` rewords it; `groma remove relation <source> <target>`
     removes it.
   These operations validate the complete change before writing. Do not edit
   Groma-owned architecture Markdown with generic file tools.
8. Run `groma scan` twice, then open the map again and review it with the human.

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
