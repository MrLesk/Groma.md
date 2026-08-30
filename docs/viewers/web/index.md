# Web viewer

The web plugin shows Groma's world in a browser. `groma web` starts it.
It does not scan on open. The live process starts the same watch as
`groma scan --watch`.

This page is the browser surface. The shared viewer rules live in
[Viewers](../index.md).

## Layout

The isometric grid fills the screen. Inset 35%-paper frosted chrome floats
above it as one technical instrument. The header shows the groma.md lockup,
the observed system's name with live flow and element counts, one compact
revision menu, one compact Fit, `-`, zoom-readout and `+` group, Help, and an icon-labelled theme
control whose label names the next choice. Help opens the short map-control
guide. The control cycles the whole viewer through Light, Dark, Blueprint,
then Light. Blueprint uses a deep navy field, pale cyan drafting lines, and
restrained calibration marks while keeping the same architecture, compass,
and accent green. The full footer is absent, and Live work keeps the bottom
centre. The camera fits architecture into the clear area between
the floating hierarchy and any open details pane, so the grid continues
beneath the chrome without hiding the fitted world.

The revision menu starts at Current revision, the live `groma/` working tree.
It lists the current branch's commits that changed `groma/`, newest first. Each
two-line row shows the subject, then an exact tag when present, short hash, and
the commit date and time in the browser's locale. A row with a commit body
shows that body on hover without repeating its subject. A selected commit
opens the complete architecture and source measurements from that same Git
snapshot. Historical views are read-only,
carry no current Backlog work, and keep their full commit id in the URL.
Commits written with an obsolete Groma Markdown contract remain visible but
are marked Unsupported and cannot be selected. Returning to Current revision
resumes live architecture and work updates.

The hierarchy pane's boxed double-chevron retracts it to a narrow rail and
returns it without changing tree, selection, or camera state. Its quiet branch lines keep nested
rows legible. It starts with the flows list open under its
Flows heading. The list holds every
actor command in the world, deduped across the actors who share it.
Clicking a command toggles its highlighted map path without changing the
selection or details pane. Several paths can stay active together. Every flow
row uses the same checkbox, active state, Global or actor scope, and toggle
behavior in the hierarchy and details pane; it has no separate flow glyph.
Structure rows use kind marks and neutral
selection instead; their arrows only expand containment. One command
has at most one active flow; picking it from an actor changes that flow's scope
in place. Below it the Structure
section starts open and groups the merged containment tree under Actors,
Systems, and External systems labels, omitting an empty group. Containers
sit under their system and components under their container, in
hierarchy order; the map places them by flow instead.
Ghost names and external systems are dim. Every selected element is marked,
and rows are collapsed except the paths to selected items; a collapsed row shows its child
count. A row's arrow
expands or collapses it by hand without changing the selection, while selected paths stay open. The
tree and the map share one selection. The bottom of the pane is the kind legend.
Authored sibling groups are invisible to the tree.

The wider details pane appears only while an element, relationship,
or task owns the selection. It keeps its width while that owner
changes and disappears when selection is cleared. Its X clears the selection,
closes the pane, and returns focus to the map without moving the camera. An element
shows under two tabs. Selecting another architecture item returns the pane to What
it does; a direct `tab=how` link still opens How it's built. What
it does holds the meaning: description, peer relationships, actor Commands,
Flows through, and children. A relationship row always names and selects its
peer; its arrow shows authored direction and never activates a flow. Commands
are the actor-scoped flows the selected actor can start. Flows through are the
general flows whose path crosses the selected software element. Both use the
same flow control as the hierarchy list. They toggle the map path in place and
keep the actor or component in the details pane. If details are closed, a flow
toggle keeps them closed. Actors do not repeat Commands as relationships
or build information.
How it's built holds the evidence: the technology the element's Markdown
declares (`technology: SVG, Bun serve` renders as one chip per
comma-separated part), exported callable TypeScript declarations under Code,
and exact authored source references with file measurements under Files. A
callable opens read-only source at its visibly marked declaration line; a file
opens at the top. Elements without build evidence do not show the tab. Children and
relationship peers select that element. To inspect a highlighted path, select
one of its items or connections on the map. When the
selection is an actor who uses a launcher, software they use that
starts other software they also use, the actor's outgoing rows
are that launcher's commands, plus whatever they use that no launcher
reaches. Click a command to light its path on
the map: the rest dims and each lit route runs in the accent green
with a moving dash from source to target. A command picked
from an actor's details walks in from that actor alone, even when
other actors share the launcher; picking the same command from the
sidebar flows list or a Travelled-by row includes every sharer's
approach. Several active flows share the map as the union of their routes.
Selecting architecture or a Backlog task keeps those routes lit. Escape or a
click on empty sheet clears them with the other active selections.

## What it shows

The whole architecture is one isometric blueprint resting on a grid
sheet. The grid is the field the architecture is built on: every
footprint is a whole number of cells and every route travels a
quarter-cell lattice. A proportional drafting band surrounds that fixed
semantic sheet without moving its cells. The grid itself runs to the edge of
the map pane at any zoom. One strong outer frame defines the band;
its small compass scales with the sheet and keeps north on the grid's up-right
axis, so the actors island is due west. A title plate in the band shows the
project name and up to three lines of the Markdown description from
`groma/README.md`. It fits its width to lines up to 80 characters; longer
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
style means origin: observed items are solid, planned ghosts dashed,
missing ghosts dotted, and only a route leaving an element an active
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
Removing that item returns details to the previous item. Click empty
sheet or press Escape to clear the selection, active flows, and active tasks;
the details pane closes. Click the boxed isometric pencil in the title plate to
open the upright project-profile editor beside it. Its bounded Write view keeps
long Markdown scrollable, and Preview renders it through Comark's sanitized HTML renderer. The
title plate projects the same parsed Markdown semantics onto the isometric sheet.
Saving asks the web host to update only
`groma/README.md`; the published world event repaints every open map without a
browser reload.
Backlog work shows as pins. Every task outside the configured terminal
status, and every task in that status changed within the last day, puts
one pin per assignee on the element the task touched last: the element
whose code holds the task's newest modified file, else the first element
the task references. An unassigned task puts one generic pin there. A pin
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
the Backlog document mark in greyscale, a dot while a nonterminal task is available,
and a chevron pointing up; unfolded it keeps the mark greyscale beside Backlog.md with
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
an element keeps the tasks active. The details pane shows the task's id,
status and assignees over its title, then its description, its
acceptance criteria as a checklist, its modified files and its
references, where a reference naming an element is a link that
selects the element; its pins carry a small arrowhead above their
badge, its chips an accent border, and the strip scrolls the first
into view. Escape or a click on empty
sheet deactivates every task. Pins move as Backlog changes, through
the same live channel as the world. The island eases its width and
height between sizes whenever it folds, unfolds, or its chips change,
and keeps its fold and filters across live updates.
The URL follows the view without adding history entries, so any
view opens again from its link:
each selected element's kind names it (`?actor=<id>`, `system=<id>`,
`container=<id>` or `component=<id>`), `relationship=<source>/<target>`
names a selected route, and repeated element and relationship parameters keep
their selection order; `task=<id>` names a selected task. Repeated
`flow=<source>/<target>` entries preserve active flow order; an actor-scoped
flow uses `flow=<actor>/<source>/<target>`. Active flows do not create a
selection or own details. `tab=how` names the How it's built tab;
`file=<path>` opens a selected component's source and `line=<number>` marks a
declaration in that file; `theme=dark` and `theme=blueprint` name the non-default themes;
defaults stay out of the URL and unknown values are ignored.
A watched TypeScript change folds and rebuilds the map without a
browser refresh. An architecture Markdown change does the same
without scanning. Selection stays if that box still exists, else the
first internal system is selected; a camera you have moved stays
where you left it, an untouched one refits to the new sheet.
