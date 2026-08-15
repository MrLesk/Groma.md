# TUI viewer

The TUI plugin shows Groma's world in a terminal. `groma view` starts it.
It does not scan.

This page is the terminal surface. The shared viewer rules live in
[Viewers](../index.md).

## What it shows

System Context, Containers, and Components are three levels over one
geometry. Observed items are solid. Planned ghosts are dotted. Each item
shows its `observed` or `planned` origin.

Items at the current level are titled cards. The active system or container
is a titled boundary. Off-level internals collapse instead of becoming
empty nested boxes. Relationships are directed arrows.

Changing level, selection, details, or terminal size never lays the
architecture out again.

## Navigation

The TUI starts at System Context with the first internal system selected.
The selected system or container defines what it enters.

- `+` enters the selection without opening details.
- `-` returns to the parent.
- Enter does the same inward step as `+` and opens details.
- Esc never changes level. Esc closes details, then exits.
- Arrows select the nearest element in that direction at the current
  level. If none exists, selection moves up a level. Arrows never descend.

The header shows the current level and item. The footer shows
`- context | containers | components +`. `z` focuses that control and
pressing `z` again restores the previous item.

Details open beside the world. `f` toggles full-screen details. Component
details show the scanner, file, and optional symbol from `code`.
