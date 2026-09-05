# Web viewer

The web plugin shows Groma's world in a browser. `groma web` starts it.
If the Groma directory, index, or project record is missing, the local server
shows browser setup for the project name and architecture folder. An existing
folder keeps its location. Initialize & scan uses the shared initialization
operation, scans automatically, and opens the map at the same address.
An initialized project runs one scan before opening. The live process then
starts the same watch as `groma scan --watch`. Startup errors appear in the
browser with the reported issue and the command to run after fixing it.

If the requested port is busy, an interactive terminal asks whether to use
another available port. Press y to continue or n to stop. Groma prints the
new address after startup. Without an interactive terminal, it exits with
an instruction to run `groma web --port 0` for an available port.

This page is the browser surface. The shared viewer rules live in
[Viewers](../index.md).

## Static publication

`groma export <directory>` writes the current Web view as static HTML,
JavaScript, snapshot, and generation files. The read-only page includes the
project profile, architecture and flows, mapped Backlog tasks with their
details and diffs, and source inspection for files owned by architecture
components. It does not include revision history or the project editor, and
it does not contact a Groma server or read the repository.

The export is a public disclosure boundary: every project description, task,
diff, and source file copied into the output can be read by anyone who can
access the static host. Groma supplies no public server, authentication, or
access control. Publish the directory only through a static host whose access
rules match the project.

With `--watch`, Groma keeps running locally and atomically replaces the static
snapshot after supported source, architecture Markdown, or Backlog changes.
An already-open page polls only the small `version.js` file on its static host,
then loads `snapshot.js` when the generation changes. It adopts that snapshot
without a reload. No inbound connection to Groma is opened.

## Layout

When no components exist, the page invites the developer to create supported
code or draft a system. An empty world shows the project name and a Draft form
that posts the same input as `groma draft system`. A world with existing
architecture keeps its map and navigation beneath a compact, dismissible
notice. The first component removes the notice without a reload. Historical
views hide it; a published snapshot offers no form.

The hierarchy Add button is hidden while creation controls are unfinished.
The element details pane ends with a Remove control only where `groma remove` would
succeed: a person or external nothing relates to, or a ghost that contains
nothing and that nothing relates to. One click asks, the second removes, and a
refusal shows the server's sentence.

On a live current map, Edit switches the selected element or relationship
from reading to one form. Save at the bottom submits changed fields through
`groma edit`; Cancel or Escape discards unsaved values. Core validates the
complete change before writing. A refused save keeps the form and saved
architecture. Live work updates keep an open form's unsaved values. Changing
selection leaves that editing session. Source evidence remains read-only.

Element fields are title, description, overview, technology, and parent
where the component can move. Empty optional values clear the
field. Relationship fields are description and technology. A matched draft
element exposes Accept; a draft relationship exposes its own explicit Accept.
Both use `groma accept`, with the relationship addressed by its two endpoints.

Element relationship lists and relationship details use the same horizontal
Source → Destination row. Clickable endpoint names and kinds flank the
relationship description and arrow. Element lists mark the selected endpoint
with THIS; the badge follows direction and can appear on either side. Clicking
the center action in an element list opens the relationship details. Lists
preserve map-level peer promotion; relationship details show exact authored
endpoints. Compact text and dividers separate rows without enclosing borders
or side padding. Rows omit technology, which remains available in Edit.
A current relationship is labeled
Current; this means an authored current collaboration, not scanner ownership.
Only draft relationships offer Remove. Core refuses removal of current
relationships through every entry point, and a flow reference also blocks
removal of a draft relationship.

The map gesture toolbar is hidden while its interactions are unfinished.
Draft software and relationship creation remain available through the CLI.

Shift-click selection still offers Group as and Combine into through the
shared operations. Pressing a group zone opens Rename and Dissolve. Historical
and published maps keep reading and navigation but expose no write controls.

Draft elements and links retain fixed dashed strokes during selection and
flow highlighting. Flow traversal uses a separate moving directional marker;
reduced-motion mode holds that marker still. Flow emphasis never replaces
lifecycle dashes. Current relationship strokes stay solid.

The isometric grid fills the screen. Inset 35%-paper frosted chrome floats
above it as one technical instrument. The header groups the groma.md lockup,
system name, quiet flow and element counts, and revision menu on the left.
A permanent Search field sits between that context and the view controls:
Fit, `-`, zoom readout, `+`, Theme, Help, and Info. Controls share one
height, and opening search leaves them in place. Header popups float with
a clear gap below the bar. At narrower widths the
counts and the Fit and Theme text give way to the controls.
Popup triggers share a pointer cursor. Clicking outside dismisses Help, Info,
Theme, Revision, and Search through the same popup behavior. Search cancellation
restores its saved view; the revision tooltip remains part of its popup.
Help explains the map shapes, drafts, relationships, and how source-file counts,
lines of code, and dependencies determine building sizes relative to the project.
It also explains Markdown curation and keeps the grouped Map, Search, View, and
layer shortcuts. A compact two-column popup places the guide beside the shortcuts
so all Help content fits without scrolling at 1280×720. The information icon opens About Groma with the Groma logo,
a brief product description and repository link, followed by every directly declared
third-party runtime library and development tool, including its version, license,
and project link. The dropdown lists Auto,
Light, Dark and Blueprint. Auto is the default for a browser profile with no
saved choice and follows that browser's light or dark colour preference. A
choice is saved for later visits. Blueprint uses a deep navy field, pale cyan drafting lines, and
restrained calibration marks while keeping the same architecture, compass,
and accent green. The full footer is absent, and Live work keeps the bottom
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

The revision menu starts at Current revision, the live selected Groma working
tree. It lists the current branch's commits that changed the selected `groma/`
or `.groma/` directory, newest first. Each
two-line row shows the subject, then an exact tag when present, short hash, and
the commit date and time in the browser's locale. A row with a commit body
shows that body on hover without repeating its subject. A selected commit
opens the complete architecture and source measurements from that same Git
snapshot. Historical views are read-only,
carry no current Backlog work, and keep their full commit id in the URL.
Commits without the required OKF v0.2 Groma project profile remain visible but
are marked Unsupported and cannot be selected. Returning to Current revision
resumes live architecture and work updates.

The hierarchy pane's boxed double-chevron retracts it to a narrow rail and
returns it without changing tree, selection, or camera state. Its quiet branch lines keep nested
rows legible. Under Flows, each actor has an accordion that starts collapsed
and retains its open state across viewer repaints. Actor rows use the shared
actor mark and sit one level below Flows, with their flow rows one level
deeper. The sidebar uses a shared 16 px nesting step and compact arrow/icon
spacing throughout the actor groups and software tree. Disclosure arrows have
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
panel keeps its own folding state.
Each group contains the
scenarios whose first step starts with that actor. Flows that start with a
software element appear directly in the list. Each row is one named, authored
scenario. Clicking it opens its
purpose and ordered steps in details and focuses its explicit map connections.
Only one flow is focused at a time; clicking it again clears it. The same
control appears in an element's Flows list. Structure rows use kind marks and
neutral selection; their arrows only expand containment. Below it the Structure
section starts open and groups the software containment tree under Systems
and External systems labels, omitting an empty group. A full-width section
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
closes the pane, and returns focus to the map without moving the camera. An element
shows under two tabs. Selecting another architecture item returns the pane to What
it does; a direct `tab=how` link still opens How it's built. What
it does holds the meaning: description, peer relationships, Flows, and children.
A relationship row names and selects its peer; its arrow shows authored
direction. The Flows list contains only scenarios with an explicit endpoint
on or inside the selected element. Each opens the same flow reader as the
hierarchy. Actors keep their real relationships and their authored flows.
How it's built holds the evidence: the technology the element's Markdown
declares (`groma.technology: SVG, Bun serve` renders as one chip per
comma-separated part), named TypeScript structure under Code, and exact
authored source references with file measurements under Files. Code follows
the authored file order. It includes exported and module-private top-level
callables; named classes group their public, protected, and private methods.
The Code reference symbol is marked as the entry point, while nested callbacks
stay out. A declaration opens read-only source at its visibly marked line; a
file opens at the top. Elements without build evidence do not show the tab. Children and
relationship peers select that element.

The flow reader shows its overview and every ordered action. Select an action,
Previous, or Next to emphasize that step's exact relationship and endpoints;
All steps restores the whole authored path. Unrelated routes are hidden and
task emphasis is quiet while reading a flow. Existing footprints and routes
stay fixed. Endpoints link to the normal component inspector and source view;
Back to flow restores the same scenario and step. Selecting a task leaves flow
focus. Escape or a click on empty sheet clears the active selections.

## What it shows

The whole architecture is one isometric blueprint resting on a grid
sheet. The grid is the field the architecture is built on: every
footprint is a whole number of cells and every route travels a
quarter-cell lattice. A proportional drafting band surrounds that fixed
semantic sheet without moving its cells. The grid itself runs to the edge of
the map pane at any zoom. One strong outer frame defines the band;
its small compass scales with the sheet and keeps north on the grid's up-right
axis, so the actors island is due west. A title plate in the band shows the
project title and up to three lines of the Markdown body overview from
the selected Groma directory's `project.md`. It fits its width to lines up to 80 characters; longer
content remains in the editor instead of growing the plate. A compact boxed
pencil sits inside its lower corner. Small
unlabeled calibration ticks line its two front edges.
The compass, title metadata, and pencil lie on the same isometric ground plane,
and every blueprint decoration uses the map's neutral grayscale palette.

Actors, external systems, and each internal system are flat islands
on the sheet, in one row along the grid from west to east so flows
read that way: the actors island, then the systems, then the external
systems; on screen the row runs from the upper left down to the right.
The actors and external islands are squares with their buildings
stacked in one column and centred, each a little bigger than what
stands on it. Inside every system island, slab and zone,
relationships decide where the children stand. These three nested
surfaces keep a two-cell band between their children and every edge;
the centred actors and external islands keep their compact band. The
surface names stay in the one-cell edge band; the larger inset belongs
only to nested contents. The
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
stretching. A building's roof hides the ground behind it, so it
claims those cells on its north and west; once that shadow outgrows
the usual gap, its neighbours there stand far enough back that the
corridor between them still shows ground. Nothing hides the ground
to its south and east, so those neighbours keep the usual gap.
Nothing stands west of the entries, and children no
relationship touches are packed as one block after them. The
actors and external islands shift across the row, north or south, so
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
one tower axis. Ghost and unmeasured components keep the minimum dimensions.
Actors are round buildings (a cylinder whose circular roof holds the
name) and external systems are pills (a stadium roof with the name on
one line), one floor each, on their own islands; a route meets the wall
itself, sliding along its own axis onto the curve, so it starts and
ends on the shape the viewer sees rather than beside it. One grey
pattern tells each kind apart, on side faces and
surfaces and never on a roof: each measured component floor carries
a stable window pattern derived from its largest member's lower-case file extension,
including extensions Groma has not seen before; components without
source evidence keep plain storey lines,
actor sides and the actors island dots, external sides and the
external island crosses, container slabs a faint grain, and system
islands have none; every pattern is laid in the plane it lies on. Facade
patterns stop below readable size while every floor face remains, and the
minor grid yields to its major lines only at the most distant scale.
Sibling groups are flat hatched zones around their members. A
translucent chip lies under every island, slab and zone name. Line
style means origin: observed items are solid, draft ghosts dashed,
and only a route leaving an element an active
task touches for one it does not adds accent dots; ghosts are hollow,
with no fill, pattern or chip, and slightly faded.

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

Names lie on the surfaces they belong to, skewed with the sheet: a
building's name on its roof, wrapped onto two lines when it is long,
and an island's, slab's, or zone's name in the free band along its
front edge. Footprints are sized so every name fits.

Routes follow the lattice: one route per authored relationship,
between the authored endpoints, preferring to leave from the middle of
the side of the source that faces the target and to arrive, pointing
inward, at the middle of the side of the target that faces the source,
keeping one lane clear of every foreign building and slab, and
running on the one ground plane from end to end, slabs included. A
route holds the middle of the free ground: it keeps a full cell clear
of every building it passes, of a slab or island border, and of a
route already drawn, unless its ends leave it nowhere else to go. A
building's back sides are hidden under its roof, so there a route
starts or ends on the
ground just behind the building where the roof's shadow ends: on screen
the line emerges from, or its arrowhead touches, the back of the
roof, with no visible step. Parallel routes spread out
around the middle; when two middles do not line up, the line stays
straight and the longer side gives way. Each route ends in an
arrowhead lying on the sheet that keeps its screen size at every
zoom. A route's description is its tooltip. Every selected box draws
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
projects the sheet isometrically, paints it as SVG, and handles
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
work island it scrolls the chip strip. `F1` toggles the HUD for a map-only
view. `F2` lifts the blueprint into aligned System, Container, and Component
layers and briefly turns the view to show that it can orbit. In layer mode,
drag to orbit horizontally with limited vertical tilt, or Shift-drag to pan;
press `F2` again to return to the fixed nested view. Selection, flows, work
pins, scrolling, zoom, and Fit continue to use the displayed geometry. `F3`
independently toggles a map debug panel, which remains visible in map-only
view. It shows live FPS; architecture-load, building-placement, arrow-routing,
projection, and SVG-paint timings for the current map generation; and the
world, sheet, building, surface, route, and route-point counts. Opening the
panel only reveals the collected snapshot and never rebuilds the map. Resizing the pane refits the
map until you move the camera; after that it keeps the same point in
the centre. Click a building, a slab, a system island, or a tree
row to select it; click a route to select its relationship, which
draws the route and both of its ends in the accent and shows the
relationship in the details pane with its ends as links. Hold Shift while
clicking an architecture item or relationship to add or remove it from the
selection. The map combines their normal selection treatments, the hierarchy
marks every selected element, and the last item selected owns the details pane.
Removing that item returns details to the previous item. Selecting a different
architecture item or task starts its details at the heading. Returning from a
task file diff with Back restores the task's previous reading position. Click empty
sheet or press Escape to clear the selection, active flows, and active tasks;
the details pane closes. Click the boxed isometric pencil in the title plate to
open the upright project-profile editor beside it. Its bounded Write view keeps
long Markdown scrollable, and Preview renders it through Comark's sanitized HTML renderer. The
title plate projects the same parsed Markdown semantics onto the isometric sheet.
Saving posts the same input as `groma edit project` and updates the standard
title and optional concise description plus the Markdown body overview in the
selected Groma directory's `project.md`; the
published world event repaints every open map without a browser reload.
Backlog work is loaded from one task-list summary and shows as pins. Every
configured task, including terminal history, puts one pin per assignee on the
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
palette. A pin that appears after the map is open bounces once in
that colour, then returns to the inactive greyscale. The
Backlog.md Tasks panel, 35%-paper frosted glass with a 28px outer radius
at the bottom centre of the map, exists while any pin does: folded it is a compact pill with
the Backlog document mark in greyscale, a small badge counting unique mapped tasks
in the enabled status filters (including zero), and a chevron pointing up.
The badge briefly pulses when shown work changes, rolls and bounces when its count
changes, and flips to a checkmark and back when shown work completes. Initial and
unchanged snapshots stay quiet. Reduced motion keeps the count without animation.
Hovering the mark shows the status counts and latest observed change. The badge
uses the same work snapshot and filters as the expanded panel and adds no label
or width to the folded pill; unfolded it keeps the mark greyscale beside Backlog.md with
Tasks on the next line, one
filter for each configured status in configuration order when that status
has at least one pin. The filters match the task chips' height, and a vertical
rule separates them from the scrollable strip of chips, one per shown pin
with its badge and task id. A filter appears on the same live update that
brings the first pin in its status. The configured default and terminal
statuses start hidden; every other configured status starts shown. A filter
hides or shows both the matching pins and chips. A visible chip also flips
once when its task becomes Done. Each completing badge stays visible through
the flip, then follows the Done filter; work that was already hidden does not
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
the accent, dotted when the target is untouched. Several tasks can be
active at once, their touched elements counted together. Clicking another
active task selects it without removing any highlight. Only clicking the
selected task again deactivates it, handing selection to the most recently
activated remaining task or to nothing. Whenever the active set changes, the
camera centres the combined projected bodies touched by every active task and the
highlighted routes leaving them at the closest allowed zoom, with a wider context
margin around that complete highlight. Switching sidebar selection without changing the active set
keeps that shared fit; removing a task refits to the remaining active work, while
clearing the final task leaves the camera in place. Selecting
an element keeps the tasks active. Opening a task loads that task's full
Backlog record on demand. The details pane shows the task's id,
status and assignees over its title, then its description, acceptance criteria,
Definition of Done, references, modified files, implementation plan,
implementation notes, and comments. Empty sections are omitted. A reference
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
`flow=<id>` names one authored scenario and `step=<number>` selects its
one-based step. With no architecture selection, the flow owns details. An
architecture selection alongside it opens endpoint inspection while retaining
the flow and step. `theme=light|dark|blueprint` names an
explicit theme, and `hud=off` hides the page chrome. Auto stays out of the URL;
reading accepts any parameter order and ignores unknown values.
A watched TypeScript change folds and rebuilds the map without a
browser refresh. An architecture Markdown change does the same
without scanning. Selection stays if that box still exists, else the
first internal system is selected; a camera you have moved stays
where you left it, an untouched one refits to the new sheet.
