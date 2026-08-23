# TUI viewer

The TUI plugin shows Groma's world in a terminal. `groma view` starts it.
It does not scan on open. The live process starts the same watch as
`groma scan --watch`. With `--plain`, or when stdout is not a terminal,
`groma view` prints the merged world as text instead, and
`groma view <target>` prints one record for an element id, plan id, or
repository-relative source file.

This page is the terminal surface. The shared viewer rules live in
[Viewers](../index.md).

## Layout

Fixed chrome frames the world. One blank row sits above the header
and one below the footer. A one-row header shows the groma
wordmark, the observed system's name with live flow and element
counts, and the exit hint on the right. A one-row footer
shows the key hints for the focused pane, and zoom controls with a
readout of the camera state: `fit` when the whole map fits, a
percentage in between, `1:1` at the closest zoom. While the `/`
filter is open, the hint line becomes the filter line. Between them sit
three panes that each reserve their width: the hierarchy pane on the
left, the map pane in the center, and the details pane on the right.
The focused pane draws its border in the selection accent. Unfocused,
the hierarchy and map borders are dim and the details border takes
the selection's origin colour and line style. The map pane is the
camera viewport; the map never renders under a side pane. `[` and `]`
collapse and restore the hierarchy and details panes; the map pane
takes the freed width immediately, and only the camera viewport
changes, never the world layout.

The hierarchy pane opens with the flows list: every person command
in the world, deduped across the people who share it, above a rule.
The list is dropped when it would leave no tree row under it.
The pane cursor walks the flow rows and the tree as one column;
Enter on a flow row lights its walk (the active row carries the
accent mark) and Right on one returns to the map. Below the rule
the pane lists the merged world as a containment tree:
people, then systems, then external systems at the root, left to
right as on the map. Containers sit under their system and
components under their container, in the same left-to-right order.
Ghost, missing and external names are dim.
Rows are collapsed except the path to the current
selection; a collapsed row shows its child count. The tree and the
map share one selection: the accent bar marks the selected element,
and map moves keep the tree in step. The tree scrolls to keep its
cursor visible. The bottom of the pane is the kind legend.
Groups are invisible to the tree, matching navigation.

The details pane always shows the current selection under two tabs;
`t` switches them and the choice persists across selections. What it
does holds the meaning: description, relationships, and children.
How it's built holds the evidence: the technology the element's
Markdown declares, the scanner, file, and optional symbol from
`code` under a files-and-lines weight line, and Travelled by, the
person commands whose walk touches the selection. While the pane is
focused, Up and Down move over the tab's pickable command rows and
Enter lights that walk. With no command rows they scroll the pane.
Enter on a person or other leaf focuses the details pane. Right on
the map with nothing further right does the same. When the
selection is a person who uses a launcher (software they use that
starts other software they also use), the person's outgoing rows
are that launcher's commands, plus the person's own relationships
the launcher does not reach. Up and Down choose one command and
light its path immediately. A command picked from a person's details
walks in from that person alone, even when other people share the
launcher; picking the same command from the flows list or a
Travelled-by row lights every sharer's approach. Esc or Left
returns to the map and leaves the path on, so arrows, Enter, and
zoom still inspect the boxes it touches. `x` clears the path.
Choosing another person command replaces it. A lit walk is drawn
whole at every level; a leg that finds no pair of attach points at
this level runs between where its real endpoints sit on the map.

While a command is active, `s` traces its walk one relationship leg
at a time: the traced leg draws heavy while the rest of the walk
stays lit, and the footer captions it as `step k/n · source →
target · label`, wrapping after the last leg. Picking a command
again restarts the trace; `x` removes it with the path.

## What it shows

System Context, Containers, and Components are three levels over one
campus. Observed items exist. Planned items are ghosts. Underlay is
not a ghost.

Software wrappers keep the world-layout size from code up. The camera
is the only shrink. Each level names that layer of internal software
and draws the next software layer as unnamed underlay. People and
external systems are marks: they keep their world origin, and their
drawn size follows the named level. Titles stay readable in screen
cells. Context draws the containers of internal systems as unlettered
underlay and does not draw components.
In Progress Backlog tasks mark the elements their references name:
the assignees sit on the element's top border in the accent, and the
details pane lists the task under a Work heading on both tabs. Work
may appear after the map is already open, and saving a task file
refreshes it. A missing or slow Backlog CLI does not block the view.

Each kind has one mark used in the tree, on the map, and in
details: a yellow ● person, a cyan ■ system, a light □ container,
and a magenta ▪ component. External systems use a dim system mark.
The map carries no kind or origin words. Details spells the kind
next to the mark and origin as a word. Person cards have rounded
corners. Planned and missing items use dashed and dotted borders,
and missing cards carry a hatched fill.

Siblings that declare the same `group` name sit together inside one
dim dashed boundary titled with that name. Groups are not selectable
and arrows ignore them.

The world is a map. The first view fits the whole map inside the map
pane. `+` and `-` zoom the camera; at the closest zoom (`1:1`), one
world unit is one column and half a row, and names stay readable.
Cards and routes have places on
that map. A route attaches to the named software, mark, or campus
wrapper, never to underlay. It promotes to an ancestor only while
the real endpoint is not one of those. The first word of a
relationship description (the first two at Components) is drawn on
its route while the selection is an endpoint or an ancestor of
exactly one endpoint, or while the route is lit.
Changing selection or terminal size never lays the architecture out
again; only the camera viewport changes.

Arrows change which item is selected. They move between siblings
inside the same boundary and keep the current zoom; the camera pans
just enough if that sibling would leave the map pane. When no sibling
lies in that direction, selection exits the boundary to the nearest
outer item in that direction and the camera zooms out. Enter on a
system or container changes C4 level inward; the hierarchy pane jumps
to any element at its level. At Containers the camera frames the
parent system and the people who use it. At Components it frames
the parent container.

## What you can do

The TUI starts at System Context with the first internal system selected.
The selected system or container defines what it enters. Components is
the last level. The first view fits the whole map.

- `+` or `=` zooms the camera in. `-` or `_` zooms out toward the
  whole map. Each step zooms by 1.25, and every camera move animates
  over 750 ms.
- Enter enters the selection: a system selects one of its
  containers, a container one of its components. Components is the
  last level. Backspace is the reverse: it leaves that level for the
  parent Enter came from. From a side pane it also returns focus to
  the map.
- A watched TypeScript change folds and redraws the map. An architecture
  Markdown change reloads the world and redraws it. Selection stays if
  that box still exists.
- `r` (or `R`) asks core for the world again and redraws it. It does
  not scan and does not re-read Backlog.
- Esc never changes level and does not exit. It returns focus from
  a side pane to the map.
- Ctrl+C leaves the viewer and restores the terminal.
- Arrows select the nearest sibling in that direction inside the
  same boundary. With no sibling that way, selection exits one level
  up to the outer item in that direction. Arrows never descend.
  Sibling moves keep zoom and pan only if needed. Leaving a boundary
  zooms out. Left or Right with nothing further in that direction
  focuses the hierarchy or details pane, selection unchanged.
- `[` toggles the hierarchy pane and `]` toggles the details pane.
  Hiding the focused pane returns focus to the map. Tab, or Left at
  the map's left edge, reopens a hidden hierarchy pane; Enter on a
  leaf, or Right at the map's right edge, reopens a hidden details
  pane.
- `/` opens a filter over element names in the footer. Typing
  narrows matches; the current match drives selection and camera
  live, with its position and name shown beside the query. Up and
  Down cycle matches. Enter keeps the selection and closes the
  filter; Esc restores the selection and camera from before the
  filter opened. The filter works with side panes collapsed.
- Tab focuses the hierarchy pane; Tab or Esc returns to the map.
  While it is focused, Up and Down move through visible rows, Right
  expands a row, and Left collapses it or climbs to its parent. Right
  on a row with nothing left to expand returns to the map. Enter
  selects that element on the map at its level and expands a
  collapsed row; the camera brings it into view and the tree stays
  focused.
