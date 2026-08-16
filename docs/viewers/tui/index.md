# TUI viewer

The TUI plugin shows Groma's world in a terminal. `groma view` starts it.
It does not scan.

This page is the terminal surface. The shared viewer rules live in
[Viewers](../index.md).

## Layout

Fixed chrome frames the world. A one-row header shows the groma
wordmark on the left and the exit hint on the right. A one-row footer
shows the level strip and key hints. Between them sit three panes that
each reserve their width: the hierarchy pane on the left, the map pane
in the center, and the details pane on the right. The map pane is the
camera viewport; the map never renders under a side pane.

The details pane always shows the current selection: name, kind,
annotations, description, relationships, and children. Component
details include the scanner, file, and optional symbol from `code`.

## What it shows

System Context, Containers, and Components are three levels over one
geometry. Observed items exist. Planned items are ghosts.

The map is built from the inside out. Components keep their laid-out
size and spacing. Each container is the box around its components.
Each internal system is the box around its containers. People and
external systems are compact cards. Those cards show the full name
when empty space around them is large enough.

The map carries no kind or origin words; the details pane spells
both out. Boundary titles are the element name. Person cards have
rounded corners. External cards draw their border dim. Planned and
missing items use dashed and dotted borders.

Siblings that declare the same `group` name sit together inside one
dim dashed boundary titled with that name. Groups are not selectable
and arrows ignore them.

The world is a map. The first view fits the whole map inside the map
pane. `+` and `-` zoom the camera; at the closest zoom, one world unit
is one cell and names stay readable. Cards, routes, and relationship
labels have places on that map. Changing selection or terminal size
never lays the architecture out again; only the camera viewport
changes.

Arrows change which item is selected. Same-level peers keep the
current zoom; the camera pans just enough if that peer would leave
the map pane. When there is no same-level peer in that direction,
selection leaves the boundary and the camera zooms out. Enter on a
system or container, and the footer `z` strip, are what change C4
level inward. At Containers the camera frames the parent system. At
Components it frames the parent container.

## What you can do

The TUI starts at System Context with the first internal system selected.
The selected system or container defines what it enters. Components is
the last level. The first view fits the whole map.

- `+` or `=` zooms the camera in. `-` or `_` zooms out toward the
  whole map.
- Enter enters the selection. On a container it selects a child
  component. Components is the last level.
- `R` asks core for the world again and redraws it.
- Esc never changes level and does not exit. It returns focus from
  the footer strip to the map.
- Ctrl+C leaves the viewer and restores the terminal.
- Arrows select the nearest element in that direction at the current
  level. If none exists, selection moves up a level. Arrows never
  descend. Same-level moves keep zoom and pan only if needed. Leaving
  a boundary zooms out.
- `z` focuses the footer strip `- context | containers | components +`
  and highlights the current level. Left and right move the highlight.
  Enter on a level name goes there and zooms the camera to fit that
  layer. Enter on `+` or `-` zooms the camera the same way the `+`
  and `-` keys do. The strip stays focused. `z` or Esc returns to
  the selected item.
