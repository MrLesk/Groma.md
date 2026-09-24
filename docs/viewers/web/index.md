# Web viewer

The web plugin shows groma.md's world in a browser. `groma web` starts it.
If the architecture directory, index, or project record is missing, the local server
shows browser setup for the project name and architecture folder. An existing
folder keeps its location. Continue uses the shared initialization operation,
then shows one selection row per scanner with detected versions and installation
state. Detection paths stay in collapsed, searchable details; declarations without
a version do not create a warning. Scanner problems appear before ordinary choices.
Install & scan installs the selected additions; with no additions selected, the
action is Scan project. Both open the map at the same address after preparation.
Setup, first scan, and regular loading use the same card frame. Setup shows
Project, Scanners, and Map navigation. The first scan replaces the form with
completed setup milestones, the current operation, and the pending map step.
Opening an initialized project uses a compact card with the project name,
version, and a left-aligned loading status, without setup navigation.

Status changes follow actual work: creating the project, finding or installing
scanners, preparing the viewer, preparing scanners, scanning, updating
architecture, loading architecture, preparing the map, and opening the map.
While scanning, each active scanner has its own row and activity indicator,
so parallel work stays visible. Its row leaves when that scanner finishes or
fails. Skipped scanners never appear as active. Both startup cards use these
rows, and pages opened during a scan receive the current active list.
Operations that do not run are not reported. There is no estimated percentage
or timer-driven progress. Before map calculation starts, the server yields
once to send its queued progress updates to the browser. The loading screen
stays visible until the initial scanner session and its architecture update
finish. An empty map is reported
only after that scan. An initialized project runs one scan, then builds its first
map once from the reconciled architecture before opening. Later source changes
queue a new map build, including changes received during the first build. The
live process starts the same watch as `groma scan --watch` before scanning, so
source edits during startup are retained. Startup errors appear in the browser
with the reported issue and the command to run after fixing it.
The startup header shows the running groma.md version during setup, loading, and errors.

[`server.ts`](../../../src/viewers/web/server.ts) owns this temporary startup
state and streams updates through `/startup-events`.
[`startup/page.ts`](../../../src/viewers/web/startup/page.ts) presents the forms
and progress; it waits for the form operation or `/ready` before opening the
next screen. The map session, map loader, and scanner session report the work
they own. The scanner registry emits a start event immediately before each
scanner invocation and an end event when it succeeds or fails. Skipped
scanners emit neither. The scanner session derives the active list from these
events.
[`startup/progress.ts`](../../../src/viewers/web/startup/progress.ts) formats
scanner names and retains the complete current update for new pages and
event-stream subscribers. These updates describe runtime activity; they do
not create stored OKF knowledge or C4 architecture elements.

If startup reports an occupied concrete port, an interactive terminal shows
the runtime error and asks whether to use
the next available port. Press y to try ports one by one above the requested
port (4748, 4749, and onward for the default 4747), or n to stop. groma.md prints
the new address after startup. Without an interactive terminal, it exits with
the runtime error and an instruction to run `groma web --port 0` for an
available port. If port 0 fails, groma.md shows the runtime error and exits
without suggesting the same command or offering another port.

This page is the browser surface. The shared viewer rules live in
[Viewers](../index.md).

## Static publication

`groma export <directory>` reads stored architecture and writes the Web view as static HTML,
JavaScript, snapshot, and generation files. The read-only page includes the
project profile, architecture, flows, and source inspection. Every export
excludes tasks, task pins, task search results, and editing controls. It does
not contact Git, Backlog, or a groma.md server.

The export is a public disclosure boundary: every project description,
diff, and source file copied into the output can be read by anyone who can
access the static host. groma.md supplies no public server, authentication, or
access control. Publish the directory only through a static host whose access
rules match the project.

Export does not run a scanner. Run `groma scan` first when source changes need
to be reflected in the stored architecture.

Export writes the requested snapshots and exits. Serve or upload the output
separately. The default captures the working tree, including uncommitted source
changes. Its time machine identifies the working tree and explains that no
other revisions are available. Run export again to update it.

Use an explicit commit to capture its architecture, source, and commit metadata
regardless of the current checkout:

```sh
groma export ./site --revision HEAD
```

Use two explicit commits for a comparison. For example, a CI job with the PR's
base and head commits available locally can run:

```sh
groma export ./site --from "$BASE_SHA" --revision "$HEAD_SHA"
```

The site opens the comparison from the older commit to the newer one, whichever
order `--from` and `--revision` name, as live groma.md does. The header's × opens
the newer commit; the ordinary revision picker offers only the two commits. A
one-commit export exposes its message,
body, and ID, with the same no-other-revisions notice. Comparison export requires
two commits; working-tree comparisons remain available in live groma.md.

`web/export.ts` packages the shared history comparison, map layout, source
contents, and outlines while the snapshot roots are available. It prepares both
individual views and their one comparison. `web/data.ts` selects those
bundled views, including shared URLs, through the same read boundary used by the
live viewer. The export adds no comparison algorithm or separate presentation.
The caller chooses the commits and static host; groma.md does not resolve a PR,
infer its merge base, or install a CI workflow.

### Social previews

Export also writes `cover-light.png`, `cover-dark.png`, and `cover-blueprint.png`
at 1200×630 pixels. Each cover uses the actual map, one continuous graph-paper
grid, and a glass footer with the project title and groma.md attribution.
The map's geometry, drawing, themes, and bundled fonts remain the source of truth.

Set the public directory URL when publishing so the initial HTML contains
absolute Open Graph page and image URLs:

```sh
groma export ./site/architecture/blueprint --url https://example.com/architecture/blueprint/
```

The publication URL selects the cover through the same theme rule as the Web
view. Auto uses the light cover because a social crawler has no visitor theme
preference. Static metadata is fixed at export time: changing `?theme=` in a
published link does not rewrite its HTML. Without `--url`, the export remains
portable with a relative light-cover link and no canonical Open Graph URL.
The publishing workflow supplies the URL; groma.md does not guess a public host.

`groma web` emits metadata using the request URL and serves the same PNGs,
generated on the first image request and refreshed after architecture changes.
The project record's standard `title` and optional `description` supply the
sharing text. An unauthored description stays absent; the overview is not
converted into a second summary. Covers are derived presentation assets, not
new OKF records or C4 elements.

Generation runs inside groma.md using resvg WebAssembly and bundled DejaVu fonts.
It needs no browser, installed fonts, or network access. The renderer and fonts
also travel inside the standalone CLI. The published website serves ordinary
PNG files and needs no groma.md process on its host.

The `iso` drawing functions produce SVG for both the interactive map and covers.
The browser mounts it and owns selection and camera movement; shared style rules
resolve explicit colours and fixed-camera stroke widths for PNG generation.
The viewport grid stays outside the moving architecture group and follows every
camera frame, line widths included, so the map shows the same grid in motion and
at rest.

The `web/sharing` domain owns publication: `cover.ts` composes the shared SVG
and footer, `images.ts` converts it to PNG, and `metadata.ts` builds the initial
sharing fields. Export and live delivery use those same owners. Bundled fonts
and their redistribution notice live together under `web/atoms/fonts`.

## Layout

An empty world shows a welcome card with the project name and a normal next
step for a project that has no code yet. **Set up scanners** opens the existing
Plugins settings dialog in live web delivery; published views omit this action.
The card sits in the map's clear area beside the visible panels and uses the
same frame as startup. The camera fits the empty sheet and its title plate into
the space below the card. The web empty-state controller owns its copy and
visibility; the settings controller owns opening and closing the dialog.
A world with existing architecture but no components keeps its map and navigation
beneath a compact, dismissible notice pointing to `groma scanner setup`. The first
component removes the notice without a reload. Historical views hide it.

The hierarchy Add button is hidden while creation controls are unfinished.
The element details pane ends with a Remove control only where `groma remove` would
succeed: a person or external nothing relates to, or a ghost that contains
nothing and that nothing relates to. One click asks, the second removes, and a
refusal shows the server's sentence.

On a live current map, Edit switches the selected element or relationship
from reading to one form. Save at the bottom submits changed fields through
`groma edit`; Cancel or Escape discards unsaved values. Core validates the
complete change before writing. A refused save keeps the form and saved
architecture. Live work updates and changes between Iso, 2D, and Layers keep
an open form's unsaved values. Changing
selection leaves that editing session. Source evidence remains read-only.

Element fields are title, description, overview, technology, and parent
where the component can move. Empty optional values clear the
field. Relationship fields are description and technology. A matched draft
element exposes Accept; a draft relationship exposes its own explicit Accept.
Both use `groma accept`, with the relationship addressed by its two endpoints.

Element relationship lists and relationship details use the same horizontal
Source → Destination row. Clickable endpoint names and kinds flank the
relationship description and arrow. Element lists mark the selected endpoint
with THIS; the badge follows direction and can appear on either side. Lists
preserve map-level peer promotion and show each ordered endpoint pair once,
with the distinct descriptions of every relationship it combines. Clicking the
center action of a single-relationship pair opens the relationship details.
Clicking the center of a combined pair unfolds its relationships beneath it,
each with its exact endpoints and its own center action; one pair stays
unfolded at a time. Relationship details show exact authored endpoints.
Compact text and dividers separate rows without enclosing borders
or side padding. Rows omit technology, which remains available in Edit.
A current relationship is labeled
Current; this means an authored current collaboration, not scanner ownership.
Only draft relationships offer Remove. Core refuses removal of current
relationships through every entry point, and a flow reference also blocks
removal of a draft relationship.

The map gesture toolbar is hidden while its interactions are unfinished.
Draft software and relationship creation remain available through the CLI.

Shift-click selection still offers Group as and Combine into through the
shared operations. Group names and zones do not open editing controls. Historical
and published maps keep reading and navigation but expose no write controls.

Neutral current relationships are solid and neutral draft relationships have
fixed dashes. Task-highlighted relationships are uniformly solid. Selected
flows use dashes moving from source to destination with a fixed arrowhead,
regardless of relationship origin. Reduced-motion mode keeps those dashes
static. Clearing task or flow highlighting restores the origin treatment.
Draft element outlines remain dashed.

The map grid fills the screen. Inset 35%-paper frosted chrome floats
above it as one technical instrument. The header groups the groma.md lockup,
project title from `project.md`, quiet system, container, and component counts,
and the revision fields on the left.
A permanent Search field sits between that context and the view controls:
Fit, `-`, zoom readout, `+`, Settings, Help, and Info. Controls share one
height, and opening search leaves them in place. Header popups float with
a clear gap below the bar. Search and the revision fields share one text field
look, `.chrome-field` in `web/atoms/chrome.ts`, and one menu entrance in
`web/atoms/popover.ts`. `web/page.ts` owns the order in which a short header
gives way: the counts, which show only above 1400 px, take just the width
nothing else wants and leave whole when less than 150 px is left for them;
Search narrows to 200 px; then the commit messages clip together. The project
title never gives way. Up to 1320 px the header has no spare room for a
comparison being started or for compare words outside a short revision field, so
Search folds to its icon until the list closes; opening Search, by key or by
clicking its icon, unfolds it. At 1080 px and below Fit, Help and Info
show only their icons, a revision field shows its exact tag or short ID instead of its
message, Search may narrow to 120 px, and an open revision search takes the whole
box. At 1000 px and below Search also stays folded while a comparison is open, so
both short IDs read whole down to the page's 900 px minimum. `page.ts` reads the
revision box's `data-starting` attribute, where the compare words stand, and the
body's `data-comparison` attribute for those folds.
Iso, 2D and Layers are icon-and-label tabs in a floating bar at the top of the
map, centered between the side panels. It shares the bottom tasks bar rounded
surface. One selection pill slides and resizes between tabs; reduced motion
switches it immediately. Click a tab or use Left/Right, Home and End while focused on the tabs.
F2 still toggles Layers, and F1 hides the bar with the other map controls.
Popup triggers share a pointer cursor. Clicking outside dismisses Help, Info,
Settings, Theme, Revision, and Search through the same popup behavior. Search cancellation
restores its saved view; the revision tooltip remains part of its popup.
Help explains the map shapes, drafts, relationships, and how source-file counts,
lines of code, and dependencies determine building sizes relative to the project.
It also explains Markdown curation and keeps the grouped Map, Search, View, and
layer shortcuts. A compact two-column popup places the guide beside the shortcuts
so all Help content fits without scrolling at 1280×720. The information icon opens About groma.md with the groma.md logo,
a brief product description and repository link, followed by every directly declared
third-party runtime library and development tool, including its version, license,
and project link. The dropdown lists Auto,
Light, Dark and Blueprint. Auto is the default for a browser profile with no
saved choice and follows that browser's light or dark colour preference. A
choice is saved for later visits. Blueprint uses a deep navy field, quieter blue drafting lines,
and groma.md green for selection and active flows, with restrained calibration marks
and the same architecture and compass. The full footer is absent, and Live work keeps the bottom
centre. The camera fits architecture into the clear area between
the floating hierarchy and any open details pane, so the grid continues
beneath the chrome without hiding the fitted world.

Search opens on focus, `/`, or Cmd/Ctrl+K. It ranks architecture matches
together with task IDs and titles supplied by the optional work-source plugin.
Task rows show their ID and status; every supplied status and unmapped task
is searchable. Without a work plugin, the same field searches architecture.
Typing updates the list without selecting a result or moving the camera.
Up and Down select and preview results in a five-row scrolling window.
Enter opens the first result if no row has been selected.
Enter or a result click opens the existing architecture or task details;
opening an active task keeps it active. Escape or a click outside search
restores the selection and camera from before the search.

The time machine starts at Current working tree. While browsing it is one
revision field in the header, as wide as its commit message. Clicking the field
turns it into the commit search in the same place and at the same width; only a
newly selected commit's message changes the field's width. The search matches commit IDs, messages,
and commit bodies. Its list sits directly under the field and follows it when the
header reflows. It shows current-branch commits newest first, including
source-only changes. Listing history reads Git metadata; architecture is loaded
only after selection. Each two-line row shows the subject, then an exact tag when
present, short hash, and the commit date and time in the browser's locale. A row
with a commit body shows that body on hover without repeating its subject. A
selected commit opens the complete architecture and source measurements from
that same Git snapshot. Historical views are read-only, carry no current Backlog
work, and keep their full commit id in the URL. The selected component stays open
if it exists in the chosen revision; otherwise its details close. A field's hover
title is its full ID and message. Escape or a click outside closes the search and
preserves the current view. An unsupported architecture reports its error at the
top of the list, which scrolls back to it, and leaves the current view intact. Returning to
Current working tree resumes live architecture and work updates. A single-snapshot
export has nothing to search: its field opens the snapshot's metadata and a
notice.

Nothing about comparing shows by default. While the open search is empty,
**or compare 2 revisions** follows the placeholder, just outside a field too short
to hold both; typing removes those words. Activating them moves the search to the start field, and "vs." and
the viewed revision slide in beside it as destination B. The list opens at the
destination row; it and every newer row are disabled, so its parents are the next
rows. The ×
appears and cancels, as do Escape and a click outside. Choosing a commit opens
A to B.

While comparing, start and destination are two fields in one box with a rule on
each side of "vs.". Each field is as wide as its commit message. Clicking a
field turns it into the commit search at the same position and width while the
other field stays in place, and the list sits under that field. A comparison
always runs from the older revision to the newer one: a start must lie further
down the list than its destination, the working tree is only ever a destination,
and the list disables every commit on the wrong side of the other endpoint. A link
that names the newer commit as the start opens the same comparison, older first.
The × ends the comparison and opens B. Ordinary browsing then opens either
individual snapshot. The URL stores A in `from` and B in `revision` (omitted for
the working tree).
`web/revision/view.ts` owns the fields, the list rows, and their motion;
`web/revision/control.ts` owns the displayed revision or pair and which field is
the search. Motion uses the chrome motion variables and is off under reduced
motion.

Comparison matches components by their stable IDs. Their own architecture or
owned-source changes mark them Modified; relationships have independent change
statuses. Tasks, flows, neighbors, and ancestor changes do not propagate that
status. The destination map and flows remain, with removed components,
relationships, and needed former parent context added from A. An ID that names a
different kind of element in each revision, such as a component that became a
container, shows as two elements: B's keeps the ID and A's is added as removed,
with A's children beneath it. Systems,
containers, and groups stay neutral. Added, Modified, and Removed use shared
theme roles; green remains the selection and active-flow color. Comparisons
have no task data or editing controls. A working-tree endpoint follows owned
source edits even when no scanner handles that file.

Comparison details keep the same What it does and How it's built tabs. Added
components show B's content; removed components keep A's readable description.
Modified prose marks changed words in place, with changed fields alongside it.
Relationships carry their own status. Files include both versions' ownership,
with actual source status and line counts; removing a component does not imply
deleting its files. Changed files open a unified diff, unchanged files the
ordinary source view. Back restores the component, tab, and reading position.
The shared details panel covers map controls within its area, while the header
remains usable.

History owns comparison facts and the shared source domain projects file hunks.
`web/comparison/details.ts` presents those facts in the existing details tabs;
`web/source/diff-view.ts` renders file rows and unified diffs for both comparison
and task review. Task review still owns task endpoints and file selection.
These are derived views of existing OKF records and C4 components, not new
stored knowledge or architecture levels.

The floating icon bar beside the hierarchy toggles Actors, Systems, Containers,
and Components on the map. Its icons follow the existing ● ■ ▱ ▪ marks with
clean geometry and gently rounded corners. All four start visible. Hover or keyboard focus shows
each icon's label; pressed buttons mark visible types. Hiding a type hides its
map bodies, connections with hidden endpoints, and attached task pins. Children
of a hidden boundary remain visible when their own type is enabled. Filtering
keeps layout, camera, hierarchy, and stored architecture unchanged. Choices stay
active across live updates and Iso, 2D, and Layers changes until the page reloads.

The hierarchy pane's boxed double-chevron retracts it to a narrow rail and
returns it without changing tree, selection, or camera state. Its quiet branch lines keep nested
rows legible. Under Actors, each actor has an accordion that starts collapsed
and retains its open state across viewer repaints. Clicking an actor selects it
on the map and opens its details; its arrow only expands or collapses its flows.
Actor rows use the shared
actor mark and sit one level below Actors, with their flow rows one level
deeper. The sidebar uses a shared 16 px nesting step and compact arrow/icon
spacing throughout the actor groups and software tree. Section and row chevrons
use the groma.md accent color and pointer cursor on hover in both panels. Row arrows have
24 px click targets; child leaf branches lead directly to their icons without
an empty arrow slot. Both sections share continuous CSS branch lines, ending
at the last child. Chevrons, entity marks and flow checkmarks are drawn in CSS.
Both sections use the same row
component; actor flow counts and software child counts remain visible when
expanded. Grouped flow labels
omit a matching actor-name prefix; the authored title remains in the reader.
Disclosure chevrons rotate between folded states, including across tree
repaints, and respect reduced-motion preferences. The details panel uses the
same grouped flow tree, limited to flows through the selected element; each
panel keeps its own folding state. In actor details, that actor's flows appear
directly under “Flows from this actor” with concise labels, without repeating the
actor as a group row.
Each group contains the
scenarios whose first step starts with that actor. Flows that start with a
software element appear directly in the list. Each row is one named, authored
scenario. Clicking it checks the flow and opens its purpose and ordered steps.
Several flows can stay checked; clicking a checked flow removes it. Their
explicit connections stay highlighted together, and the last checked flow owns
the reader. Adding or removing a flow centers and adjusts the camera to fit all
remaining flows' endpoints and routes, stopping at normal readable label size.
Clearing the last flow leaves the camera
in place. The same
control appears in an element's Flows list. Structure rows use kind marks and
neutral selection; their arrows only expand containment. Below it the Structure
section starts open and lists internal systems directly, with an External systems
label before external entries. A full-width section
divider separates the external systems from the internal structure. Actors appear in the
flow accordions and remain on the map. Containers
sit under their system and components under their container, in
hierarchy order; the map places them by flow instead.
Ghost names are dim; established external systems use normal text contrast.
Every selected element is marked,
and rows are collapsed except the paths to selected items. A row's arrow
expands or collapses it by hand without changing the selection, while selected paths stay open. The
tree and the map share one selection. The bottom of the pane is the kind legend.
Authored sibling groups are invisible to the tree.

The wider details pane appears only while an element, relationship,
flow, or task owns the selection. It keeps its width while that owner
changes and disappears when selection is cleared. Its X clears the selection,
closes the pane, and returns focus to the map without moving the camera.
The horizontal opposing-arrow button beside X expands or collapses this same
panel for every kind of content, including source and file diffs. Arrows point
outward to expand and inward to collapse. Expanded normal details fit a 640px
content column with ordinary padding. Source and diffs use a wider panel that
keeps the hierarchy on desktops and leaves map space on large screens. Both
readers fit the available width on narrow screens without moving the map camera.
The panel width animates while its content uses the final layout width, keeping
line breaks and control positions steady throughout the motion. Source and diffs expand by
default until the reader explicitly chooses a width. That choice then stays with
the panel across selection changes and file inspection. Acceptance criteria use
strong read-only checkmarks, distinct from flow checkboxes.
Selecting a component automatically accents its directly connected components
in softer green, in either relationship direction, without following another
hop. Other components are dimmed while a component is selected. The selected
component has a slow breathing green glow around its shape, while its border,
fill and text stay steady; reduced motion keeps the glow steady. This emphasis follows the
selection without changing the camera or detail owner. Task and flow highlights
remain active, with unrelated components dimmed until component selection clears.
An element
shows under two tabs. Selecting another architecture item returns the pane to What
it does; a direct `tab=how` link still opens How it's built. What
it does holds the meaning: description, peer relationships, Flows, and children.
A relationship row names and selects its peer; its arrow shows authored
direction. The Flows list contains only scenarios with an explicit endpoint
on or inside the selected element. Each opens the same flow reader as the
hierarchy. Actors keep their real relationships and their authored flows.
How it's built holds the evidence: the technology the element's Markdown
declares (`groma.technology: SVG, Bun serve` renders as one chip per
comma-separated part), and the source outline under Code. Code follows the
authored file order, whichever scanners own its files. Each file is the full
path; its measurements sit on hover. Declarations nest under that file:
top-level functions and types with their visibility, and each type's methods
and constructors, as the
[source outline contract](../../scanners/creating-a-plugin.md#source-outline)
defines. The Code reference symbol is marked as the entry point, while nested
callbacks stay out. A declaration opens read-only source at its visibly marked line; a
file opens at the top. Back from a file returns How it's built to the same
reading position. A method with possible copies shows a warning labeled possible duplicates;
the warning expands the other copies nested under that method, each with
the operation name and its file:line. Similar copies note that they are not
identical. Elements without build evidence do not show the tab. Children and
relationship peers select that element.

The flow reader shows its overview and every ordered action. Opening a flow from
element details adds Back to that element above the reader. Select an action,
Previous, or Next to focus a step: the whole authored path and its endpoints stay
highlighted while the camera smoothly fits that step's exact relationship and
endpoints. Its endpoint components use the same breathing green glow as component
selection, while their outlines, bodies and labels stay steady.
Relationship lines keep only their directional motion.
The focused action has a marked row; Clear focus removes the extra emphasis and
smoothly fits all checked flows again. Reduced motion keeps static emphasis.
Unrelated routes are hidden while reading a flow. Components touched by active
tasks keep their highlights alongside the flow. Existing footprints and routes
stay fixed. Endpoints link to the normal component inspector. Opening source from
that inspector uses Back to the component and does not also offer Back to flow.
Leaving the file restores Back to flow, which returns the same scenario, step,
and original return target, and
fits all checked flows again. Returning to the original element centers and
fits that element while keeping the flows highlighted. Selecting a task leaves flow
focus. Escape or a click on empty sheet clears the active selections.

## What it shows

The whole architecture is one isometric blueprint resting on a grid
sheet. The grid is the field the architecture is built on: every
footprint is a whole number of cells and every route travels a
quarter-cell lattice. A proportional drafting band surrounds that fixed
semantic sheet without moving its cells. The grid itself runs to the edge of
the map pane at any zoom. One strong outer frame defines the band;
its compass scales with the sheet and keeps north on the grid's up-right
axis, so the actors island is due west. A title plate in the band shows the
project title and up to three lines of the Markdown body overview from
the selected architecture directory's `project.md`. It fits its width to lines up to 80 characters; longer
content remains in the editor instead of growing the plate. When the sheet is
narrower than the plate, as on an empty or small map, the frame widens west to
hold it, with the compass centred between the frame edge and the plate. A compact boxed
pencil sits inside its lower corner. Small
unlabeled calibration ticks line its two front edges.
The compass has a clear inset for its ring and direction letters inside the frame.
The compass, title metadata, and pencil lie on the same isometric ground plane,
and every blueprint decoration uses the map's neutral grayscale palette.

Actors, external systems, and each internal system are flat islands
on the sheet, in one row along the grid from west to east so flows
read that way: the actors island, then the systems, then the external
systems; on screen the row runs from the upper left down to the right.
The actors and external islands have their buildings stacked in one column
and centered above an external name band. Width and depth fit the content
independently, without forcing these islands into squares. Inside every system island, slab and zone,
relationships decide where the children stand. These three nested
surfaces keep two cells of padding around their contents. Actors and external
islands keep one cell around their contents. Every packed surface reserves a
front band outside its painted boundary for its title and a short leader line.
The parent includes each child's complete envelope, so nested names stay clear
of sibling contents and the parent's boundary. The
plain system surface sits half a tint step lighter on the same grey
scale, so the broadest internal boundary stays in the background.
The children something outside the surface feeds stand first, in a
west column (in a system, whatever an actor or another island feeds
directly); when that
column would be more than three times as deep as wide it folds into a
square-ish block. Every other child then takes its place in order of
weight, the heaviest child with a placed partner first, at the cheapest
spot beside the siblings it talks to or beside everything placed so
far: a spot is priced by the arrows it makes (their length, their
bends, and a forced way around another sibling counting more than
any length), by the arrows it would stand in the way of, and by the
cells it adds to the surface's longer side, so a heavy target comes
next to what feeds it, light intermediates settle at the edges,
partners line up into straight runs and chains wrap instead of
stretching. Children no relationship touches are packed as one block after
them. That growth placement is only where a surface starts. Its children
then settle like electrons around a nucleus: every two siblings push apart until
four cells of ground stand between them, partners
pull back toward the two-cell sibling gap and toward facing each other so their
routes can run straight, all of them drift toward the middle of the surface, and
entries drift west while nothing stands west of them. Pairs left closer than the
sibling gap are pushed apart and every corner lands on a whole cell. A surface
whose children share no relationship keeps its growth placement.
Placement and routing share one connection-space calculation. Each building
reserves its full roof shadow, port clearance, and turning room. Ports keep room
for a stroke lane on either side; additional connections grow the minimum
footprint and its surrounding space. Groups, containers and islands include the
connection space of their contents, and container composition keeps those
allowances when moving whole subtrees. These are drawing rules; they do not
change the stored elements, relationships or source evidence.
The actors and external islands shift across the row, north or south, so
their buildings face what they talk to.
Containers are slabs whose top is level with the ground and whose
thickness hangs below the grid line, drawn over the island in front of
them, so they read as slabs while everything on them stays on the one
plane. Components are buildings on their slab. Every source file belongs to
one visible floor group. The project component with the fewest files has one
floor and the one with the most has five; other file counts map linearly
between them. Each group takes the maximum member measurements. Its
`heightUnits` use the project-relative one-to-four LOC range, width shows
distinct source-file dependents, and depth shows distinct source-file
dependencies. Floors are ordered largest-first and lower footprints expand
where needed so no upper floor overhangs them. Every floor stays centred on
one tower axis. Ghost and unmeasured components keep the minimum dimensions required by their names and connection ports.
Actors are round buildings (a cylinder whose circular roof holds the
name) and external systems are pills (a stadium roof with the name on
one line), one floor each, on their own islands; a route meets the wall
itself, sliding along its own axis onto the curve, so it starts and
ends on the shape the viewer sees rather than beside it. One grey
pattern tells each kind apart, on side faces and
surfaces and never on a roof: each measured component floor carries
a stable window pattern derived from its largest member's lower-case file extension,
including extensions groma.md has not seen before; components without
source evidence keep plain storey lines,
actor sides and the actors island dots, external sides and the
external island crosses, container slabs a faint grain, and system
islands have none; every pattern is laid in the plane it lies on. Facade
patterns stop below readable size while every floor face remains. Surface
patterns, the island dots and crosses, slab grain and group hatching, stop once
the dots, crosses and hatching repeat closer than two screen pixels. Grid lines
thin as their rows close up, so the grid keeps one weight at every zoom, and
rows closer than six pixels leave: minor rows first, then the whole grid.
Sibling groups are flat hatched zones around their members. Their names use
the same external label treatment as islands and slabs. Line
style means origin: observed items are solid, draft ghosts dashed,
and only a route leaving an element an active
task touches for one it does not adds accent dots; ghosts are hollow,
with no fill or pattern, and slightly faded.

Weight follows depth, like heading levels: islands, slabs, buildings
and routes each sit one level below the one before, every level 1.4
times thinner in stroke and mixing 1.8 times the ink into its surface.
So islands
and slabs carry a light tint, a building's sides lie one level
deeper than its roof (the left face half a level more), routes are
hairlines, and actors keep paper faces. Hover, selection and lit
routes climb the same ladder instead of setting widths of their own,
and every stroke scales with the square root of the zoom relative to
fit, between three quarters and twice its fit width. Island, slab,
zone, and building names always show.

Building names stay on their roofs, wrapped onto two lines when long. Island,
slab, and zone names sit below their own front boundaries, centered on a short
leader line. Names and leaders follow the sheet plane in both isometric and
2D overhead views. System and container labels select their owning element;
their text and leader share the boundary's selection and lit-state highlight.
Surface titles keep systems larger than containers, and containers larger than groups.
They use four fixed size and spacing presets, from overview to close inspection.
Each preset has fixed geometry in the sheet plane; zoom chooses a preset without
adjusting it to the exact camera scale. Component names keep their measured roof size.
Roofs, external label bands, and the project plate grow to fit their text.
Surface bands reserve fixed room for the larger overview titles during layout.
Camera fit includes the complete surface envelopes, including external labels.
Each surface title, its leader, and its selectable area stay inside the reserved
band below its own boundary. The desired text size is limited by the band's
width and height, so it cannot cross the surrounding boundary at distant zoom.
Labels and their hit areas move with the cached map during pan and zoom. Their SVG
geometry stays unchanged throughout movement and across zoom stops within the same
range. Only crossing a preset boundary updates the labels after movement settles;
painting a new scene starts with its matching preset. Zoom never changes the packed
world. No component name is hidden at any zoom.
Groups remain visual groupings within their existing parent.

Routes follow the channels between buildings: one route per authored
relationship, between the authored endpoints, preferring to leave from the
middle of the side of the source that faces the target and to arrive, pointing
inward, at the middle of the side of the target that faces the source, and
running on the one ground plane from end to end, slabs included. At a building
a route may leave or arrive by another side, only where that avoids a crossing
or saves real length, from the middle of that side; at a system island or
container slab it keeps its assigned side. A route runs
down the centre line of each channel it takes, half a cell clear of the
buildings on either side. Routes that share a channel form a bundle a third of a
cell apart, centred on the channel, closing up toward an eighth of a cell only
where the channel is too narrow for the whole bundle; the shortcuts that later
straighten route ends keep that spacing. Along a shared stretch,
and round a corner they take together, routes keep one order, so they cross
only where they meet or part, and only when they meet and part on opposite sides
of each other. A route pays for its length, its bends, a side other than the
one it prefers, every route it crosses, and every channel it crowds past that
comfortable spacing, so a full channel sends routes around other
buildings. Ports slide along the middle half of their wall to make room
for a bundle, and when two walls face each other their ports line up so the
route between them runs straight. A
building's back sides are hidden under its roof, so there a route
starts or ends on the
ground just behind the building where the roof's shadow ends: on screen
the line emerges from, or its arrowhead touches, the back of the
roof, with no visible step. The displayed endpoint meets the visible building
outline in the current view; in 2D it reaches the flattened footprint instead
of stopping at the isometric roof offset. Endpoint bends move with those ports
without adding small staircases beside the building. Endpoints stay in the middle half of each usable
wall, including after shortcuts. When two middles do not line up, the line stays
straight and the longer side gives way. Each route ends in an
arrowhead lying on the sheet that keeps its screen size at every
zoom. Every relationship remains
visible at normal contrast. A route's description is its tooltip. Every selected box draws
every edge and its name in the accent green, the name in bold, the
slab or island it stands on is
outlined in the accent as its context, and the routes that touch the
selection turn green too; selected routes add their two ends to the same treatment,
and fills never change. A lit actor command
draws its routes in the accent with a moving dash. The direct source
and target elements carry the same accent on their outline and name;
slabs and islands that only contain the path stay neutral at full
opacity, and everything off the path dims.

The map never reads architecture Markdown or calculates layout. Core
composes the sheet from the merged world: islands, slabs, buildings,
zones and routes, all in cells. The web server ships the project profile,
world, sheet, configured Backlog workflow, available tasks and their pins
together; the browser only
projects the sheet in the selected view, paints it as SVG, and handles
camera, selection, the project-profile form, and the lit flow. It may not move a footprint or
reroute a relationship.

## What you can do

The first view fits the whole sheet inside the map pane. The first
internal system is selected. Two fingers on a trackpad, or the
wheel, pan the map; a pinch zooms as far as the fingers move, and
cmd or ctrl with the wheel zooms about the cursor; the `-` and `+`
buttons and keys zoom about the center, and `0` refits, between half
the fitted view and a cell 192 screen pixels wide. Dragging pans too;
scrolling or pinching over a pin moves the map, and over the Live
work island it scrolls the chip strip. On a touch screen, one finger drags
and two fingers pinch: the map zooms about the point between them and pans
as that point moves. A two-finger touch never selects, and the finger left
after a pinch keeps dragging. Panel selection, flow steps, search navigation,
Fit, and zoom buttons move and zoom together in a quick 220 ms transition.
A new action starts from the displayed camera position. Dragging, scrolling,
and pinching follow the gesture directly and stop an unfinished transition.
A drag released while still moving glides on in the same direction and slows to
a stop, like trackpad momentum; a pause before release, a pinch, and a Layers
orbit do not glide, and reduced motion turns the glide off. Pressing the map
holds the camera where it is, stopping a glide or an unfinished transition, and
any other navigation takes over from the displayed position.
The map keeps one cached camera layer, which direct gestures and navigation that pans or zooms in move without
redrawing the map. Navigation that zooms out draws its destination first and moves that picture into place, enlarged
at the start, so it looks soft while it moves; shrinking a close-up picture would freeze Safari. The map restores
crisp SVG rendering after movement settles.
Component selection and focused flow endpoints share one glow per
highlighted shape. Each uses a small, separate layer containing its blurred
silhouette. The blur stays fixed while the layer's opacity pulses every 2.6
seconds; the shape's border, fill and text do not animate, so the glow never
repaints the map. The glow hides while the map moves (panning, zooming, a view
change, orbiting or a settling world update) and returns once the map has been
still for 250 ms. It follows the displayed projection and camera, and disappears
when its highlight clears or its shape is filtered out.
A hover highlight stays on its element while the map moves, including trackpad inertia, and moves to whatever is under the pointer once the map settles.
Selection highlights and clicking remain available throughout.
Reduced motion applies the destination without animation. `F1` toggles the HUD for a map-only
view. The floating camera bar selects Iso, 2D, or Layers. 2D looks straight down on the same
layout, drawing one flat footprint per element without changing its source
files, architecture, or relationships. Switching to or from 2D turns the camera
and lowers or raises the buildings over 850 ms, gently starting and settling.
The tiers widen into their final footprint as they flatten; layer spacing moves
with the camera. A new view choice continues from the displayed pose.
Reduced motion applies the final geometry immediately.
Iso and 2D fit the selected architecture so it remains readable; with no
architecture selection they fit the whole map. Layers fits the whole stack.

A world update moves the map the same way instead of repainting it in place.
Over 700 ms the displayed sheet blends into the new placement: islands, slabs,
buildings and routes that exist in both glide to their new cells, a new
building grows out of the ground while its routes draw on from their source,
and a departed building shrinks away while its routes retract. Surfaces keep
their label band while they grow, and a building shows its name once it is
half grown. Updates that arrive faster than a transition, such as a replayed
history or a revision change, continue from the blend on screen and settle in
the time between updates, never faster than 160 ms. A camera nobody has moved
follows the changing sheet on the same clock; a hand-positioned camera stays
where it is. Reduced motion, a placement identical to the one shown, and maps
above 500 surfaces apply the update at once.

`F2` lifts the blueprint into aligned System, Container, and Component
layers and briefly turns the view to show that it can orbit. In layer mode,
drag to orbit horizontally with limited vertical tilt, or Shift-drag to pan;
press `F2` again to return to the previous Iso or 2D view. Selection, flows, work
pins, scrolling, zoom, and Fit continue to use the displayed geometry. `F3`
independently toggles a map debug panel, which remains visible in map-only
view. It shows live FPS; architecture-load, building-placement, arrow-routing,
projection, and SVG-paint timings for the current map generation; and the
world, sheet, building, surface, route, and route-point counts. Opening the
panel only reveals the collected snapshot and never rebuilds the map. Resizing the pane refits the
map until you move the camera; after that it keeps the same point in
the centre. Clicking a building, slab, system island, relationship, or task pin
on the map selects it without moving the camera and stops any unfinished transition.
When a component is selected, a plain click on an internal system first clears
the architecture selection without moving the camera. A second click selects
the system. Shift-click still toggles selection immediately, and hierarchy,
details, and search selections remain immediate. Active tasks and flows stay highlighted.
Selecting an item in the hierarchy, Details, search, or another control outside
the map centers the camera on its complete body. Automatic focus
stops at normal readable label size; larger selections zoom out until they fit.
Manual zoom can go closer. Systems and containers include their contained architecture. The fit uses
the displayed nested or separated geometry and the clear area between the side
panes. Architecture selection from details or an accepted search result uses the
same fit. Selecting a relationship draws the route and both of its ends in the accent and shows the
relationship in the details pane with its ends as links. Hold Shift while
clicking an architecture item or relationship to add or remove it from the
selection. The map combines their normal selection treatments, the hierarchy
marks every selected element, and the last item selected owns the details pane.
Selections made outside the map fit the combined architecture selection.
Removing that item returns details to the previous item. Selecting a different
architecture item or task starts its details at the heading. Returning from a
task file diff or from component source with Back restores the previous reading
position. Click empty
sheet or press Escape to clear the selection, active flows, and active tasks;
the details pane closes. Click the boxed isometric pencil in the title plate to
open the upright project-profile editor beside it. Its bounded Write view keeps
long Markdown scrollable, and Preview renders it through Comark's sanitized HTML renderer. The
title plate projects the same parsed Markdown semantics onto the isometric sheet.
Saving posts the same input as `groma edit project` and updates the standard
title and optional concise description plus the Markdown body overview in the
selected architecture directory's `project.md`; the
published world event repaints every open map without a browser reload.
Backlog work is loaded from one task-list summary and shows mapped tasks as pins.
Every configured task with a mapped architecture element, including terminal
history, puts one pin per assignee on the
element the task touched last: the element whose code holds the task's newest
modified file, else the first element it references. An unassigned task puts
one generic pin there. A pin
is a round badge with the assignee's mark (the vendor mark for the claude
and codex handles, else a two-letter monogram), or the Backlog document
mark for an unassigned task, inside a ring that fills by checked acceptance criteria
over total, the task id under it, a stem from the roof (a slab's top
or a system island's surface) near its left corner, and a tooltip
with the task's title; when the task is Done the badge shows a checkmark
and flips back while hovered. A visible pin that becomes Done flips into
that checkmark once. Every assignee and
task pair has its own colour, the pairs in task order over a fixed
palette. When a task touches another component, its existing pin travels to
the new component in an 850 ms arc with a soft start and landing. A further
component change redirects it from its current position. Pan and zoom keep
the moving pin aligned with the map; reduced motion places it immediately.
A pin that appears after the map is open bounces once in
that colour, then returns to the inactive greyscale. The
Backlog.md Tasks panel, 35%-paper frosted glass with a 28px outer radius
at the bottom centre of the map, stays visible while Backlog has a configured workflow,
even with no mapped tasks: folded it is a compact pill with
the Backlog document mark in greyscale, a small badge counting unique mapped tasks
in the enabled status filters (including zero), and a chevron pointing up.
The badge briefly pulses when shown work changes, rolls and bounces when its count
changes, and flips to a checkmark when shown work completes. The checkmark stays
for 2.5 seconds, then fades out over 300 ms before the count returns. Initial and
unchanged snapshots stay quiet. Reduced motion keeps the count without animation.
Hovering the mark shows the status counts and latest observed change. The badge
uses the same work snapshot and filters as the expanded panel and adds no label
or width to the folded pill; unfolded it keeps the mark greyscale beside Backlog.md with
Tasks on the next line, one
filter for each configured status in configuration order when that status
has at least one pin. The filters match the task chips' height, and a vertical
rule separates them from the scrollable strip of chips, one per shown pin
with its badge and task id. A filter appears on the same live update that
brings the first pin in its status. The configured default and intermediate
statuses start shown; the terminal status starts hidden. Default-status pins
and their task labels use the map's dashed draft treatment. A filter
hides or shows both the matching pins and chips. A visible chip also flips
once when its task becomes Done. Each completing badge stays visible through
the flip and a 2.5-second checkmark hold. If the Done filter is off, the pin or chip
then fades out over 300 ms; otherwise it stays visible. Work that was already hidden does not
appear just to animate. Done chips are grey. Hovering a chip, like hovering a
pin head, shows the task's title. The pins still shown on an element fan out
leftwards from that foot point afresh, so a pin left alone stands
on it. Pins and chips are
greyscale until their task is active: clicking a pin's head or a
chip activates and selects an inactive task, so its pins and chips show their colour
and its chips add an accent pill outline, while only its pins add an accent
ring around their badge. The selected task whose details are shown also bolds
its chip text; the map outlines every element the task touches, those whose code holds one of its modified
files and those it references, and draws the routes leaving them in
the same solid accent, whether or not the target is touched. Several tasks can be
active at once, their touched elements counted together. Clicking another
active task selects it without removing any highlight. Only clicking the
selected task again deactivates it, handing selection to the most recently
activated remaining task or to nothing. Selecting a task outside the map
centres the camera on the combined projected bodies touched by every active task and the
highlighted routes leaving them at the closest allowed zoom, with a wider context
margin around that complete highlight. Clicking a task pin keeps the camera
in place, including when it adds or removes active work. Removing a task outside
the map refits to the remaining active work; clearing the final task leaves the camera in place. Selecting
an element keeps the tasks active. Opening a task loads that task's full
Backlog record on demand. The details pane shows the task's id,
status and assignees over its title, then its description, acceptance criteria,
Definition of Done, implementation plan, references, modified files,
implementation notes, and comments. Empty sections are omitted. Updates to the same
task keep the current details visible while loading. Changed checks, fields, and
rows animate in place; unchanged rows keep focus and the panel keeps its scroll
position. Reduced motion applies changes immediately. A reference
naming an element is a link that selects it. The selected task's pins carry a
small arrowhead above their badge, its chips an accent border, and the strip
scrolls the first into view.

Selecting a component adds a Tasks tab only when at least one Backlog task
touches it through a mapped modified file or an exact architecture reference.
The tab groups the configured default status as To do, the last configured
status as Done, and every intermediate status as In progress. Selecting a task
row opens the same task details and map highlight as its pin or chip. A component
without linked tasks, including in a project without Backlog, keeps its existing
details tabs. Escape or a click on empty
sheet deactivates every task. Pins move as Backlog changes, through
the same live channel as the world. The island eases its width and
height between sizes whenever it folds, unfolds, or its chips change,
and keeps its fold and filters across live updates.
The URL follows the view without adding history entries, so any
view opens again from its link:
parameters are written from broad context to specific location. `revision=<commit>`
names the world snapshot. Each selected element's kind names it (`actor=<id>`,
`system=<id>`, `container=<id>` or `component=<id>`),
`relationship=<source>/<target>` names a selected route, and repeated selection
parameters keep their order; `task=<id>` names a selected task instead.
`tab=how|tasks` names the details tab, then `file=<path>` opens a selected
component's source and `line=<number>` marks a declaration in that file.
Repeated `flow=<id>` parameters name checked scenarios in selection order;
`step=<number>` selects the last flow's one-based step. With no architecture
selection, the last flow owns details. An
architecture selection alongside it opens endpoint inspection while retaining
the checked flows and focused step. Opening a shared selection fits its content.
`theme=auto|light|dark|blueprint` names an explicit theme, and `hud=off` hides
the page chrome. A publication path ending in `/architecture/{theme}/`, with
any repository prefix, also selects one of those themes. An explicit query
theme takes priority over the path, then the saved browser preference applies.
The Theme menu writes an override only when its choice differs from the path
theme. Without a path theme, Auto stays out of the URL. Reading accepts any
parameter order and ignores unknown values.
A page that shows the map in an iframe, such as a slide deck or a
documentation site, opens another view without reloading it. It posts
`{ gromaView: '?component=<id>&tab=how' }` to the iframe, using the same
query string, and the camera moves there as it does for the same selection
made in the map. A view that names no selection clears it and fits the whole
sheet. The posted view sets the selection, flows and step, task, details tab,
source `file` and `line`, and `hud`; the theme and revision stay as they are. The map posts
`{ gromaReady: true }` to the embedding page once it can take views. Only the
parent window is heard, so a map opened directly ignores every message.
An embedding page that draws its own frame opens the map with `inset=<pixels>`.
Everything drawn over the map, from the header and both panes to the view
switch, filters, work island and first-scan notice, then stays that far inside
every window edge, while the map still fills the window and the camera fits
selections into the space the chrome leaves. The value is a positive whole
number of pixels; anything else keeps the usual layout.
A watched TypeScript change folds and rebuilds the map without a
browser refresh. An architecture Markdown change does the same
without scanning. Selection stays if that box still exists, else the
first internal system is selected; a camera you have moved stays
where you left it, an untouched one refits to the new sheet.

## Saved architecture without scanners

Opening an existing project always reads saved architecture. Available selected
scanners can refresh their evidence while missing or removed scanners' Code and
relationships remain saved. With no installed selections, scanning does nothing.
A failed active scanner reports its error and leaves the previous scan result.
Architecture edits and Backlog updates remain live independently.

The toolbar's icon-only **Settings** dropdown offers **Plugins** in live web
and a nested **Theme** dropdown in both live web and static exports.
Both menus fade and move gently from their trigger when opening and closing;
reduced motion switches them immediately.
**Plugins** opens the Settings dialog without an expand action. It groups
installed selections, team selections missing locally, and recommendations.
Each scanner card shows its name, version, origin, and installation status.
Collapsed details contain the package source, full errors, and detected paths.
Filter paths within a card; long lists scroll inside the details section.
Add an npm/Git/local source, install a
recommendation, restore a missing package, remove a project selection, retry
scanning or update a version explicitly. Successful changes update source
subscriptions without reopening the viewer. Removal keeps saved architecture.
A separate warning appears only when scanning needs attention and opens the
affected plugin in Settings. Healthy projects and partial coverage hints do not
show a warning.

**Project review** contains potential duplicate findings, source comparisons and
map navigation. Its neutral toolbar icon gains a dot when findings are available.
Static exports offer duplicate review without plugin management.
See [scanner settings](../../scanners/setup.md) for status details.
