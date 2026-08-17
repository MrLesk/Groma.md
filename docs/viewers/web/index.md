# Web viewer

The web plugin shows Groma's world in a browser. `groma web` starts it.
It does not scan on open. The live process starts the same watch as
`groma scan --watch`.

This page is the browser surface. The shared viewer rules live in
[Viewers](../index.md).

## Layout

Fixed chrome frames the world as one warm-white technical sheet with
graphite hairline rules. A header strip shows the groma.md lockup. A
footer holds the `-` and `+` zoom buttons beside the Fit, Plan, and
Iso controls, a zoom readout (a percentage after zooming, nothing
while fitted), and, on the left, either a quiet control hint or the
active person command with `x clear`. Between them sit three panes
that each reserve their width: the hierarchy pane on the left, the
map pane in the center, and the details pane on the right. The map
pane is the camera viewport; the city never renders under a side
pane.

The hierarchy pane lists the merged world as a containment tree:
people, then systems, then external systems at the root, left to
right as on the map. Containers sit under their system and
components under their container, in the same left-to-right order.
Ghost names are dim. Rows are collapsed except the path to the current
selection; a collapsed row shows its child count. A row's arrow
expands or collapses it by hand without changing the selection. The
tree and the map share one selection. The bottom of the pane is the kind legend.
Groups are invisible to the tree.

The details pane always shows the current selection: name, kind,
origin, description, relationships, children, and code. Component
details include the scanner, file, and optional symbol from `code`.
Children and relationship peers select that element. When the
selection is a person who uses a launcher — software they use that
starts other software they also use — the person's outgoing rows
are that launcher's commands. Click a command to light its path on
the city: the rest dims and each lit route carries a green rule with
surveyed points travelling from source to target. The path stays
while other boxes are selected. `x` clears it. Choosing another
person command replaces it.

## What it shows

The whole world is one map resting on the sheet; a quiet survey grid
rules the sheet and a soft shadow grounds each root element. Iso, the
default view, is a true isometric
projection; Plan is the top-down view. Parents with children render as plates; children sit on
them; leaves render as prisms. A leaf with observed code rises with
the lines behind it, so heavier components stand taller; leaves
without code keep their kind's base height. Each C4 kind is visually distinct. Sibling
groups are neighborhood zones. Planned items are ghosts with dashed
edges. Routes follow the laid-out paths and ride on the surfaces
they cross: a route climbs a plate's edge with a vertical step and
never passes under a box. Names sit on the top face. A
relationship description is drawn on its route only while the
selection is an endpoint or an ancestor of exactly one endpoint,
or while that route is on a lit person-command path.

The map never reads architecture Markdown or calculates layout. It
projects the world Core already has.

## What you can do

The first view fits the whole map inside the map pane. The first
internal system is selected. Scrolling or the `+` and `-` buttons
zoom. Dragging pans. Right-dragging (or ctrl- or alt-dragging)
orbits the camera freely: full turns around the city, tilt clamped
between just above ground level and top-down, never under the city.
The Plan and Iso buttons reset the camera to their fixed views and
re-fit; orbiting away clears their pressed state. Fit re-fits the
current view. Click a box or a tree row to select it. Click empty space or Esc
keeps the selection. A person command stays on the city until `x`.
A watched TypeScript change folds and rebuilds the city without a
browser refresh. An architecture Markdown change does the same
without scanning. Selection stays if that box still exists.
