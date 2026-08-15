# TUI viewer

The TUI plugin shows Groma's world in a terminal. `groma view` starts it.
It does not scan.

This page is the terminal surface. The shared viewer rules live in
[Viewers](../index.md).

## What it shows

System Context, Containers, and Components are three levels over one
geometry. Observed items exist. Planned items are ghosts. Off-level
internals collapse so the current level stays the subject.

The world is a map. Cards, routes, and relationship labels have places
on that map. Changing selection, details, or terminal size never lays
the architecture out again.

Details overlay the map. They do not take space from it.

Arrows change which item is selected. The camera stays unless that item
would leave the visible area; then it pans just enough to keep the
selection on screen. `+` and Enter on a system or container are what
change which part of the map is in view.

## What you can do

The TUI starts at System Context with the first internal system selected.
The selected system or container defines what it enters.

- `+` enters the selection without opening details.
- `-` returns to the parent.
- Enter does the same inward step as `+` and opens details.
- `R` asks core for the world again and redraws it.
- Esc never changes level. Esc closes details, then exits.
- Arrows select the nearest element in that direction at the current
  level. If none exists, selection moves up a level. Arrows never descend.
- `z` focuses the level control. Pressing `z` again restores the previous
  item.
- Details show the selection's name, kind, annotations, description,
  relationships, and children. Component details include the scanner,
  file, and optional symbol from `code`. `f` toggles full-screen details.
