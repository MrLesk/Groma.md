# Web viewer

The web plugin shows Groma's world in a browser. `groma web` starts it.
It does not scan on open. The live process starts the same watch as
`groma scan --watch`.

This page is the browser surface. The shared viewer rules live in
[Viewers](../index.md).

## Layout

Fixed chrome frames the world as one warm-white technical sheet with
graphite hairline rules. A header strip shows the groma.md lockup,
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

The hierarchy pane opens with the flows list: every person command
in the world, deduped across the people who share it. Clicking one
lights its walk on the map, exactly like picking it from a person's
details, and the active row is highlighted. Below it the pane lists
the merged world as a containment tree:
people, then systems, then external systems at the root, left to
right as on the map. Containers sit under their system and
components under their container, in the same left-to-right order.
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
quarter-cell lattice. The sheet is the content plus breathing room.

People, external systems, and each internal system are flat islands
on the sheet, in one row from left to right so flows read that way:
the people island, then the systems, then the external systems.
Containers are low slabs on their system's island. Components are
buildings on their container's slab: every 150 observed lines of
code add half a floor up to three floors, one code file is a block,
two or three files stack as tiers, four or more files make a hatched
tower. People and external systems are one-floor buildings on their
own islands, told apart by fill pattern and border: people carry a
dotted roof and a dashed edge, external systems a cross-hatched roof
and a dash-dot edge. Sibling groups are flat hatched zones around
their members. Planned items are ghosts with dashed edges; missing
items are dotted.

Names lie on the surfaces they belong to, skewed with the sheet: a
building's name on its roof, wrapped onto two lines when it is long,
and an island's, slab's, or zone's name in the free band along its
front edge. Footprints are sized so every name fits.

Routes follow the lattice: one route per authored relationship,
between the authored endpoints, leaving through a half-cell port,
keeping one lane clear of every foreign building, entering a building
or slab on a side the viewer can see, and climbing onto a container's
deck with one visible step where the slab begins. Parallel routes
take neighbouring ports. A route's description is its tooltip. The
selection draws in the accent green, with the routes that touch it;
a lit person command draws its routes in the accent with a moving
dash and dims everything off the path.

The map never reads architecture Markdown or calculates layout. Core
composes the sheet from the merged world: islands, slabs, buildings,
zones and routes, all in cells. The web server ships the world and its
sheet together; the browser only projects the sheet isometrically,
paints it as SVG, and handles camera, selection and the lit flow. It
may not move a footprint or reroute a relationship.

## What you can do

The first view fits the whole sheet inside the map pane. The first
internal system is selected. Scrolling zooms about the cursor; the
`-` and `+` buttons and keys zoom about the center, and `0` refits.
Dragging pans. Click a building, a slab, a system island, or a tree
row to select it. Click empty sheet and the selection stays. A person
command stays on the map until `x`.
A watched TypeScript change folds and rebuilds the map without a
browser refresh. An architecture Markdown change does the same
without scanning. Selection stays if that box still exists, and the
camera stays where you left it.
