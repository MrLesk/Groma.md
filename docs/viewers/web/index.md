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
it. Clicking one lights its walk on the map, exactly like picking it
from a person's details, and the active row is highlighted. Below it
the pane lists the merged world as a containment tree:
people, then systems, then external systems at the root. Containers
sit under their system and components under their container, in
hierarchy order; the map places them by flow instead.
Ghost names are dim. Rows are collapsed except the path to the current
selection; a collapsed row shows its child count. A row's arrow
expands or collapses it by hand without changing the selection. The
tree and the map share one selection. The bottom of the pane is the kind legend.
Groups are invisible to the tree.

The details pane always shows the current selection under two tabs
that persist across selections. What it does holds the meaning:
description, relationships, and children. How it's built holds the
evidence: the technology the element's Markdown declares
(`technology: SVG, Bun serve` renders as one chip per
comma-separated part), the scanner, file, and optional symbol from
`code`, and Travelled by, the person commands whose walk touches
the selection; clicking one lights that walk. Children and
relationship peers select that element. When the
selection is a person who uses a launcher, software they use that
starts other software they also use, the person's outgoing rows
are that launcher's commands. Click a command to light its path on
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
centred, each a little bigger than what stands on it.
Inside every surface, relationships decide where the children stand.
The children something outside the surface feeds stand first, in a
west column (in a system, whatever a person uses directly); when that
column would be more than three times as deep as wide it folds into a
square-ish block. Every other child then takes its place in order of
weight, the one with the most relationships first, at the cheapest
spot beside the siblings it talks to or beside everything placed so
far: a spot is priced by the arrows it makes (their length, their
bends, and a forced way around another sibling counting more than
any length), by the arrows it would stand in the way of, and by the
cells it adds to the surface's longer side, so a heavy target comes
next to what feeds it, light intermediates settle at the edges,
partners line up into straight runs and chains wrap instead of
stretching. Nothing stands west of the entries, and children no
relationship touches are packed as one block after them. The
people and external islands slide along the row so their buildings
face what they talk to.
Containers are slabs whose top is level with the ground and whose
thickness hangs below the grid line, drawn over the island in front of
them, so they read as slabs while everything on them stays on the one
plane. Components are buildings on their slab: the observed component
with the most code lines stands four floors, the one with the fewest
one floor, and every other in between in half floors by its share of
that range; one code file is a block, two or three files stack as
tiers, four or more files make a tower.
People are round buildings (a cylinder whose circular roof holds the
name) and external systems are pills (a stadium roof with the name on
one line), one floor each, on their own islands; a route still meets
the middle of a footprint side, where the curve touches it. One grey
pattern tells each kind apart, on side faces and
surfaces and never on a roof: component sides carry storey lines,
person sides and the people island dots, external sides and the
external island crosses, container slabs a faint grain, and system
islands have none; every pattern is laid in the plane it lies on.
Sibling groups are flat hatched zones around their members, and a
translucent chip lies under every name that lies on a pattern. Line
style means origin and nothing else: observed items are solid,
planned ghosts dashed, missing ghosts dotted.

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
keeping one lane clear of every foreign building, and running on the
one ground plane from end to end, slabs included. A building's back
sides are hidden under its roof, so there a route starts or ends on the
ground just behind the building where the roof's shadow ends: on screen
the line emerges from, or its arrowhead touches, the middle of the
roof's back edge, with no visible step. Parallel routes spread out
around the middle; when two middles do not line up, the line stays
straight and the longer side gives way. A route's description is its
tooltip. The selected box draws every edge and its name in the
accent green, the name in bold, the slab or island it stands on is
outlined in the accent as its context, and the routes that touch the
selection turn green too; fills never change. A lit person command
draws its routes in the accent with a moving dash and dims everything
off the path.

The map never reads architecture Markdown or calculates layout. Core
composes the sheet from the merged world: islands, slabs, buildings,
zones and routes, all in cells. The web server ships the world and its
sheet together; the browser only projects the sheet isometrically,
paints it as SVG, and handles camera, selection and the lit flow. It
may not move a footprint or reroute a relationship.

## What you can do

The first view fits the whole sheet inside the map pane. The first
internal system is selected. Two fingers on a trackpad, or the
wheel, pan the map; a pinch zooms as far as the fingers move, and
cmd or ctrl with the wheel zooms about the cursor; the `-` and `+`
buttons and keys zoom about the center, and `0` refits.
Dragging pans too. Click a building, a slab, a system island, or a tree
row to select it; click a route to select its relationship, which
draws the route and both of its ends in the accent and shows the
relationship in the details pane with its ends as links; click empty
sheet or press Escape to deselect, and the details pane empties. A
person command stays on the map until `x`.
Agents at work show as pins. Every Backlog task In Progress, and
every task Done in the last day, puts one pin per assignee on the
element the task touched last: the element whose code holds the
task's newest modified file, else the first element the task
references. A pin is a round badge with the assignee's two-letter
monogram inside a ring that fills by checked acceptance criteria over
total, the task id under it, a stem to the roof and a tooltip with
the task's title; when the task is Done the badge flips to a green
checkmark and flips back while hovered. Every assignee and task pair
has its own colour, the pairs in task order over a fixed palette. The
Live work island sits at the bottom centre of the map, above the
footer, while any pin exists: folded it is a pill with the Backlog
mark, a dot while a task is in progress, and a chevron; unfolded it
shows the Live work label, an Agents toggle that hides the
in-progress pins and a Completed toggle that hides the finished ones,
and a scrollable strip of chips, one per pin with its badge and task
id, in progress first, then a Done divider and the finished chips in
grey; clicking a chip selects the element its pin stands on. Pins
move as Backlog changes, through the same live channel as the world.
The URL follows the view so any view opens again from its link:
the selected element's kind names it (`?person=<id>`, `system=<id>`,
`container=<id>` or `component=<id>`), `relationship=<source>/<target>`
names a selected route, `flow=<source>/<target>` the lit
command (with `by=<person>` when it was picked from that person's
details), `tab=how` the How it's built tab and `theme=dark` the theme;
defaults stay out of the URL and unknown values are ignored.
A watched TypeScript change folds and rebuilds the map without a
browser refresh. An architecture Markdown change does the same
without scanning. Selection stays if that box still exists, and the
camera stays where you left it.
