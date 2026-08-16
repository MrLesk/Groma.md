# Web viewer

The web plugin shows Groma's world in a browser. `groma web` starts it.
It does not scan.

This page is the browser surface. The shared viewer rules live in
[Viewers](../index.md).

## Layout

Fixed chrome frames the world. A header shows the groma wordmark. A
footer holds the 2D and 3D controls and a zoom readout: `fit` when the
whole map fits, a percentage after zooming. Between them sit three
panes that each reserve their width: the hierarchy pane on the left,
the map pane in the center, and the details pane on the right. The map
pane is the camera viewport; the city never renders under a side pane.

The hierarchy pane lists the merged world as a containment tree:
people, then systems, then external systems at the root, left to
right as on the map. Containers sit under their system and
components under their container, in the same left-to-right order.
Ghost names are dim. Rows are collapsed except the path to the current
selection; a collapsed row shows its child count. The tree and the
map share one selection. The bottom of the pane is the kind legend.
Groups are invisible to the tree.

The details pane always shows the current selection: name, kind,
origin, description, relationships, children, and code. Component
details include the scanner, file, and optional symbol from `code`.
Children and relationship peers select that element.

## What it shows

The whole world is one map. 3D is the default city view. 2D is the
top-down plan. Parents with children render as plates; children sit on
them; leaves render as prisms. Each C4 kind is visually distinct. Sibling
groups are neighborhood zones. Planned items are ghosts with dashed
edges. Routes follow the laid-out paths. Names sit on the top face. A
relationship description is drawn on its route only while the
selection is an endpoint or an ancestor of exactly one endpoint.

The map never reads architecture Markdown or calculates layout. It
projects the world Core already has.

## What you can do

The first view fits the whole map inside the map pane. The first
internal system is selected. Scrolling zooms. Dragging pans. The 2D
and 3D buttons switch the two fixed views and re-fit the camera.
Click a box or a tree row to select it. Click empty space or Esc
keeps the selection.
