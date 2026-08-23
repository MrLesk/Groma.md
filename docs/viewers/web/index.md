# Web viewer

The web plugin shows Groma's world in a browser. `groma web` starts it.
It does not scan on open. The live process starts the same watch as
`groma scan --watch`.

This page is the browser surface. The shared viewer rules live in
[Viewers](../index.md).

## Layout

Fixed chrome frames the world as one white technical sheet with
grey hairline rules. A header strip shows the groma.md lockup,
the observed system's name with live flow and element counts, and a
Dark/Light toggle. The toggle swaps the whole viewer, chrome and map
alike, between the light sheet and a dark one; the accent green stays
the same. A footer holds the `-` and `+` zoom buttons, a zoom readout
(a percentage relative to the fitted view, nothing while fitted), and,
on the left, either a quiet control hint or the active person command
with `x clear`. Between them sit three panes that each reserve their
width: the hierarchy pane on the left, the map pane in the center, and
the details pane on the right. The map pane is the camera viewport; the
map never renders under a side pane.

The hierarchy pane starts with the flows list folded under its
Flows heading; clicking the heading opens it. The list holds every
person command in the world, deduped across the people who share
it. Clicking one lights its walk on the map from every person who
shares it, and the active row is highlighted. Below it the Structure
section starts open and lists the merged world as a containment tree:
people, then systems, then external systems at the root. Containers
sit under their system and components under their container, in
hierarchy order; the map places them by flow instead.
Ghost names and external systems are dim. Every selected element is marked,
and rows are collapsed except the paths to selected items; a collapsed row shows its child
count. A row's arrow
expands or collapses it by hand without changing the selection, while selected paths stay open. The
tree and the map share one selection. The bottom of the pane is the kind legend.
Groups are invisible to the tree.

The details pane always shows the last selected item; an element
shows under two tabs whose choice persists across selections. What
it does holds the meaning: description, relationships, and children.
How it's built holds the
evidence: the technology the element's Markdown declares
(`technology: SVG, Bun serve` renders as one chip per
comma-separated part), the scanner, file, and optional symbol from
`code`, and Travelled by, the person commands whose walk touches
the selection; clicking one lights that walk. Children and
relationship peers select that element. When the
selection is a person who uses a launcher, software they use that
starts other software they also use, the person's outgoing rows
are that launcher's commands, plus whatever they use that no launcher
reaches. Click a command to light its path on
the map: the rest dims and each lit route runs in the accent green
with a moving dash from source to target. A command picked
from a person's details walks in from that person alone, even when
other people share the launcher; picking the same command from the
sidebar flows list or a Travelled-by row lights every sharer's
approach. The path stays while other boxes are selected. `x` clears
it. Choosing another person command replaces it.

## What it shows

The whole architecture is one isometric blueprint resting on a grid
sheet. The grid is the field the architecture is built on: every
footprint is a whole number of cells and every route travels a
quarter-cell lattice. The sheet is the content plus breathing room;
the grid itself runs to the edge of the map pane in every direction at
any zoom, a slightly heavier border runs around the sheet with crop
ticks at its corners, and a compass rose lies in the sheet's west
corner with north along the grid's up-right axis, so the people island
is due west.

People, external systems, and each internal system are flat islands
on the sheet, in one row along the grid from west to east so flows
read that way: the people island, then the systems, then the external
systems; on screen the row runs from the upper left down to the right.
The people and external islands are squares with their buildings
stacked in one column and centred, each a little bigger than what
stands on it. Inside every system island, slab and zone,
relationships decide where the children stand. These three nested
surfaces keep a two-cell band between their children and every edge;
the centred people and external islands keep their compact band. The
surface names stay in the one-cell edge band; the larger inset belongs
only to nested contents. The
plain system surface sits half a tint step lighter on the same grey
scale, so the broadest internal boundary stays in the background.
The children something outside the surface feeds stand first, in a
west column (in a system, whatever a person or another island feeds
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
people and external islands shift across the row, north or south, so
their buildings face what they talk to.
Containers are slabs whose top is level with the ground and whose
thickness hangs below the grid line, drawn over the island in front of
them, so they read as slabs while everything on them stays on the one
plane. Components are buildings on their slab: the observed component
with the most code lines stands four floors, the one with the fewest
one floor, and every other in between in half floors by its share of
that range; one code file is a block, two or three files stack as
tiers, four or more files make a tower. Ghost components stand one
floor, as does every component when all observed ones have the same
line count.
People are round buildings (a cylinder whose circular roof holds the
name) and external systems are pills (a stadium roof with the name on
one line), one floor each, on their own islands; a route still meets
the middle of a footprint side, where the curve touches it. One grey
pattern tells each kind apart, on side faces and
surfaces and never on a roof: component sides carry storey lines,
person sides and the people island dots, external sides and the
external island crosses, container slabs a faint grain, and system
islands have none; every pattern is laid in the plane it lies on.
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
hairlines, and people keep paper faces. Hover, selection and lit
routes climb the same ladder instead of setting widths of their own,
and every stroke scales with the square root of the zoom relative to
fit, between three quarters and twice its fit width. Building names
appear once their roof font reaches six screen pixels; island and
slab names always show.

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
route holds the middle of the free ground: it keeps out of the two
lanes beside a slab or island border, and out of the two lanes beside
a route already drawn, unless its ends leave it nowhere else to go. A
building's back sides are hidden under its roof, so there a route
starts or ends on the
ground just behind the building where the roof's shadow ends: on screen
the line emerges from, or its arrowhead touches, the middle of the
roof's back edge, with no visible step. Parallel routes spread out
around the middle; when two middles do not line up, the line stays
straight and the longer side gives way. Each route ends in an
arrowhead lying on the sheet that keeps its screen size at every
zoom. A route's description is its tooltip. Every selected box draws
every edge and its name in the accent green, the name in bold, the
slab or island it stands on is
outlined in the accent as its context, and the routes that touch the
selection turn green too; selected routes add their two ends to the same treatment,
and fills never change. A lit person command
draws its routes in the accent with a moving dash and dims everything
off the path.

The map never reads architecture Markdown or calculates layout. Core
composes the sheet from the merged world: islands, slabs, buildings,
zones and routes, all in cells. The web server ships the world, its
sheet, the active tasks and their pins together; the browser only
projects the sheet isometrically, paints it as SVG, and handles
camera, selection and the lit flow. It may not move a footprint or
reroute a relationship.

## What you can do

The first view fits the whole sheet inside the map pane. The first
internal system is selected. Two fingers on a trackpad, or the
wheel, pan the map; a pinch zooms as far as the fingers move, and
cmd or ctrl with the wheel zooms about the cursor; the `-` and `+`
buttons and keys zoom about the center, and `0` refits, between half
the fitted view and a cell 192 screen pixels wide. Dragging pans too;
scrolling or pinching over a pin moves the map, and over the Live
work island it scrolls the chip strip. Resizing the pane refits the
map until you move the camera; after that it keeps the same point in
the centre. Click a building, a slab, a system island, or a tree
row to select it; click a route to select its relationship, which
draws the route and both of its ends in the accent and shows the
relationship in the details pane with its ends as links. Hold Shift while
clicking an architecture item or relationship to add or remove it from the
selection. The map combines their normal selection treatments, the hierarchy
marks every selected element, and the last item selected owns the details pane.
Removing that item returns details to the previous item. Click empty
sheet or press Escape to clear the selection, and the details pane empties. A
person command stays on the map until `x`.
Agents at work show as pins. Every Backlog task In Progress, and
every task Done in the last day, puts one pin per assignee on the
element the task touched last: the element whose code holds the
task's newest modified file, else the first element the task
references. A pin is a round badge with the assignee's mark (the
vendor mark for the claude and codex handles, else a two-letter
monogram) inside a ring that fills by checked acceptance criteria
over total, the task id under it, a stem from the roof (a slab's top
or a system island's surface) near its left corner, and a tooltip
with the task's title; when the task is Done the badge flips to a
checkmark and flips back while hovered. Every assignee and
task pair has its own colour, the pairs in task order over a fixed
palette. The
Live work island, frosted glass at the bottom centre of the map
above the footer, exists while any pin does: folded it is a pill with
the pulse mark, a dot while a task is in progress, and a chevron
pointing up; unfolded it shows the Live work label, an Agents toggle
that hides every pin and chip, a Completed toggle that hides the
finished ones while Agents is on, and a scrollable strip of chips,
one per pin with its badge and task id, in progress first and the
finished ones in grey; hovering a chip, like hovering a pin head,
shows the task's title. The pins still shown on an element fan out
leftwards from that foot point afresh, so a pin left alone stands
on it. Pins and chips are
greyscale until their task is active: clicking a pin's head or a
chip activates the task, so its pins and chips show their colour
with an accent ring around their badge, and the map outlines every
element the task touches, those whose code holds one of its modified
files and those it references, and draws the routes leaving them in
the accent, dotted when the target is untouched; clicking it again
deactivates it, and several tasks can be active at once, their
touched elements counted together. The
task activated last is the selection (deactivating it hands the
selection to the one activated before it, or to nothing; selecting
an element keeps the tasks active): the details pane shows its id,
status and assignees over its title, then its description, its
acceptance criteria as a checklist, its modified files and its
references, where a reference naming an element is a link that
selects the element; its pins carry a small arrowhead above their
badge, its chips an accent border, and the strip scrolls the first
into view. Escape or a click on empty
sheet deactivates every task. Pins move as Backlog changes, through
the same live channel as the world. The island eases its width and
height between sizes whenever it folds, unfolds, or its chips change,
and keeps its fold and toggles across live updates.
The URL follows the view without adding history entries, so any
view opens again from its link:
each selected element's kind names it (`?person=<id>`, `system=<id>`,
`container=<id>` or `component=<id>`), `relationship=<source>/<target>`
names a selected route, and repeated element and relationship parameters keep
their selection order; `task=<id>` names a selected task,
`flow=<source>/<target>` the lit command (with `by=<person>` when it
was picked from that person's details), `tab=how` the How it's built
tab and `theme=dark` the theme;
defaults stay out of the URL and unknown values are ignored.
A watched TypeScript change folds and rebuilds the map without a
browser refresh. An architecture Markdown change does the same
without scanning. Selection stays if that box still exists, else the
first internal system is selected; a camera you have moved stays
where you left it, an untouched one refits to the new sheet.
