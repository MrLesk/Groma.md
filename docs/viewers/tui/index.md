# TUI viewer

The TUI plugin shows Groma's world in a terminal. `groma view` starts it.
It does not scan.

This page is the terminal surface. The shared viewer rules live in
[Viewers](../index.md).

## What it shows

System Context, Containers, and Components are three levels over one
geometry. Observed items exist. Planned items are ghosts.

The map is built from the inside out. Components keep their laid-out
size and spacing. Each container is the box around its components.
Each internal system is the box around its containers. People and
external systems are compact cards. Those cards show the full name
when empty space around them is large enough.

The map carries no kind or origin words; the details overlay spells
both out. Boundary titles are the element name. Person cards have
rounded corners. External cards draw their border dim. Planned and
missing items use dashed and dotted borders.

Siblings that declare the same `group` name sit together inside one
dim dashed boundary titled with that name. Groups are not selectable
and arrows ignore them.

The world is a map. The first view fits the whole map on screen. `+`
and `-` zoom the camera; at the closest zoom, one world unit is one
cell and names stay readable. Cards, routes, and relationship labels
have places on that map. Changing selection, details, or terminal size
never lays the architecture out again.

Details overlay the map. They do not take space from it. While side
details are open, the camera pans just enough that the selected item
stays clear of the panel.

Arrows change which item is selected. Same-level peers keep the
current zoom; the camera pans just enough if that peer would leave
the screen. When there is no same-level peer in that direction,
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
- Enter enters the selection and opens details. On a container it
  selects a child component. Components is the last level.
- `R` asks core for the world again and redraws it.
- Esc never changes level. Esc closes details and does not exit.
- Ctrl+C leaves the viewer and restores the terminal.
- Arrows select the nearest element in that direction at the current
  level. If none exists, selection moves up a level. Arrows never
  descend. Same-level moves keep zoom and pan only if needed. Leaving
  a boundary zooms out. Arrows still work while side details are open.
- `z` focuses the footer strip `- context | containers | components +`
  and highlights the current level. Left and right move the highlight.
  Enter on a level name goes there and zooms the camera to fit that
  layer. Enter on `+` or `-` zooms the camera the same way the `+`
  and `-` keys do. The strip stays focused. `z` or Esc returns to
  the selected item.
- Details show the selection's name, kind, annotations, description,
  relationships, and children. Component details include the scanner,
  file, and optional symbol from `code`. `f` toggles full-screen details.
