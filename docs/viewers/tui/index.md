# TUI viewer

The TUI plugin shows Groma's world in a terminal. `groma view` starts it.
It does not scan.

This page is the terminal surface. The shared viewer rules live in
[Viewers](../index.md).

## Layout

Fixed chrome frames the world. A one-row header shows the groma
wordmark on the left and the exit hint on the right. A one-row footer
shows the key hints for the focused pane, and zoom controls with a
readout of the camera state: `fit` when the whole map fits, a
percentage in between, `1:1` at the closest zoom. While the `/`
filter is open, the hint line becomes the filter line. Between them sit
three panes that each reserve their width: the hierarchy pane on the
left, the map pane in the center, and the details pane on the right.
The focused pane draws its border in the selection accent; the others
stay dim. The map pane is the camera viewport; the map never renders
under a side pane. `[` and `]` collapse and restore the hierarchy and
details panes; the map pane takes the freed width immediately, and
only the camera viewport changes, never the world layout.

The hierarchy pane lists the merged world as a containment tree:
people, systems, and external systems at the root, containers under
their system, components under their container. Ghost rows use the
planned and missing colors; a ghost leaf also carries a `◌` marker.
Rows are collapsed except the path to the current
selection; a collapsed row shows its child count. The tree and the
map share one selection: the accent bar marks the selected element,
and map moves keep the tree in step. The tree scrolls to keep its
cursor visible. Groups are invisible to the tree, matching
navigation.

The details pane always shows the current selection: name, kind,
annotations, description, relationships, and children. Component
details include the scanner, file, and optional symbol from `code`.
Right on the map with nothing further right focuses the details pane;
Up and Down scroll overflowing content, and Esc or Left returns to
the map. Selection changes reset the scroll.

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
system or container changes C4 level inward; the hierarchy pane jumps
to any element at its level. At Containers the camera frames the
parent system. At Components it frames the parent container.

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
  a side pane to the map.
- Ctrl+C leaves the viewer and restores the terminal.
- Arrows select the nearest element in that direction at the current
  level. If none exists, selection moves up a level. Arrows never
  descend. Same-level moves keep zoom and pan only if needed. Leaving
  a boundary zooms out. Left or Right with nothing further in that
  direction focuses the hierarchy or details pane, selection
  unchanged.
- `[` toggles the hierarchy pane and `]` toggles the details pane.
  Hiding the focused hierarchy pane returns focus to the map; Tab
  reopens a hidden hierarchy pane.
- `/` opens a filter over element names in the footer. Typing
  narrows matches; the current match drives selection and camera
  live, with its position and name shown beside the query. Up and
  Down cycle matches. Enter keeps the selection and closes the
  filter; Esc restores the selection and camera from before the
  filter opened. The filter works with side panes collapsed.
- Tab focuses the hierarchy pane; Tab or Esc returns to the map.
  While it is focused, Up and Down move through visible rows, Right
  expands a row, and Left collapses it or climbs to its parent. Enter
  selects that element on the map at its level and the camera brings
  it into view; the tree stays focused.
