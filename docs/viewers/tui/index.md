# Terminal viewer

Run `groma view` to scan the repository and inspect its architecture in a
terminal. The screen has a header, a hierarchy pane, a map, a details pane, and
a footer. Panes reserve their columns and never cover the map. They start folded
by width so the map keeps at least 60 columns: both open at 120 columns and
wider, the hierarchy alone from 90 to 119, none under 90. `t` opens and focuses
the hierarchy; `d` opens and focuses details. Pressing the focused pane's key
again folds it and returns to the map. Live resizing folds an inactive pane when needed
to keep forty map columns. An explicitly opened pane receives keys; the other
pane folds if both do not fit. Inside a container map the header shows the scope path with
the component count.

## Map scopes

The root map uses Core's sheet placement order to make a compact terminal
layout. It shows actor, internal-system, and external-system islands. A system
island lists one row per container and one block per component. Blocks wrap
inside the fitted island. Component cards, group zones, and container slabs stay
hidden at root. Relationships whose exact endpoint is hidden attach to its
visible row or island.

Enter on a container opens its fitted container map. It shows the container
slab, its group zones, and its component buildings. Neighbours occupy narrow named
strips: names read vertically at the sides and horizontally above or below.
Backspace returns to root with the container selected. Escape returns focus to
the map without changing its scope or selection. No other element opens
a map scope.

Each component stands as a building. Its name and glyph sit in the top border,
and each visible floor names its largest file with +N for the rest. Draft
buildings and routes use dashed frames. The selected building draws heavy in the
brand green.

## Camera and selection

The map has one readable scale. It has no fit-all state, zoom keys, or zoom
readout. The active island or container fits the current map width and stays
centred, leaving room for its neighbours to peek. Changing selection does not
rearrange cards, rows, routes, or labels.

At root, Up and Down walk the rows of one island; Left and Right move to the
neighbouring island. Inside a container, each arrow chooses the nearest building
that lies in the pressed direction. Left and Right cross to the neighbouring
container when no building remains that way. Arrows never open or leave a
container scope or pane focus. Proximity uses card rectangles, including a
one-row overlap, rather than a cone between their centres. The camera follows
selection toward the centre, limited by the displayed map bounds. Near an edge,
the selection moves away from centre. A change in available map width may wrap
cards and rows; selection alone keeps their geometry fixed. Stepping a flow reveals its visible destination without
changing selection or map scope.

The hierarchy and `/` search can select architecture outside the current scope.
Selecting a component opens its parent container; selecting any outer element
returns to root. The hierarchy uses `●` actor, `■` system, `▱` container, and `▪`
component glyphs, with `▾` and `▸` disclosure and `▌` for the current item.

## Revision history

`h` gives the hierarchy pane to the current branch commits that changed the
Groma directory, newest first. Each row shows the subject, short hash, and date.
Commits without the current Groma project profile remain visible as Unsupported
but cannot be opened. `h` or Escape closes the list.

Enter opens a compatible commit as a read-only world. The header names that
revision, source inspection reads from the same commit, and Backlog work is
absent. Escape returns to Current; the live architecture and work watchers then
resume updating the map.

The root architecture is vertically centered in the map canvas when it fits;
taller roots retain scrolling to reveal the selected row.

## Details and flows

The details pane describes the current architecture selection.
While a flow row has hierarchy focus, it instead shows that flow and its current
leg. While details has focus, Tab cycles through What and How, plus Tasks for a
component. Actors show their meaning and Flows without a build tab. What describes its
responsibility, relationships and Flows through checkboxes; How shows technology and source; Tasks groups related
work by status. In the
How tab the Code section lists each file with its line count and the declarations
under it in authored order; Enter on a declaration opens the source read-only at
that line. A task record's modified files open their unified diff. Escape returns.
Task records, source and diffs share a reading layout with up to 80 text columns.
An open task keeps that width across focus changes when the hierarchy and a
readable map also fit.
When the terminal cannot fit a readable map beside it, the reader temporarily
takes that space. Closing the reader restores the normal pane layout.

The hierarchy lists actor flows above the architecture tree. Up and Down browse
their meaning without changing the map. Space or Enter checks one flow, opens
the root overview, and lights its path and visible endpoints. Checking another
flow replaces the active one. Unrelated architecture becomes quieter without moving.
Unchecking the flow or pressing `x` restores the prior map scope and selection.
The architecture selection keeps its own marker. `s` advances to a leg, whose route
and visible destination carry the stronger treatment. When an exact endpoint is
hidden at root, the destination marker names it on its visible container and the
footer shows both names. `x` clears the flow. Actor details use the same Flows
name and checkbox behavior; software connections remain Relationships.

## Work focus

The map always shows compact task markers on visible architecture anchors. A reserved
centered, bordered Backlog strip beneath it summarizes current work and points to
`w`. It shows per-status counts when they fit and a total count at narrow widths. Neither treatment
covers or changes the architecture canvas.

`w` gives the hierarchy and details panes to Backlog tasks without changing the
stored architecture selection, map scope, camera, flow, or map layout. Tasks
follow the configured workflow statuses. Group headings show status. Rows show the full title and acceptance progress
as a pie glyph beside the exact completed/total count. To Do comes first and starts folded; In Progress starts
expanded and Done folded. Up and Down browse visible headers and tasks. Left and
Right fold or open a status group; Enter on a header toggles expansion. Folding a
selected task moves the cursor to its header. Enter on a task opens its full record.
The component Tasks tab opens that same record and map highlight. Within a
record, Up and Down move a visible reading cursor through every row, including
long definitions and notes. A file
or architecture reference becomes selectable when its row is reached. Enter
opens that file diff or architecture element. Escape from a diff restores the
same reading row. Both record
entry points show title, description, acceptance criteria and Definition of Done
before execution status, assignees, plan, modified files, notes and comments.
Modified files show A (added), D (removed), M (modified), or · (unchanged), with
added/removed line counts and a Shared mark when another active task lists the
same file. The record and file reader use one task diff snapshot. Diff rows show
old/new line numbers, red/green change gutters and the same syntax tokens as the
web reader.

The selected task accents every element touched by its modified files and exact
architecture references, plus routes leaving those elements. If all touched elements
belong to one container, Work temporarily opens that component map. Otherwise it uses
the root map and promotes hidden components to their visible containers. The camera
reveals the touched set without rearranging it. Closing Work focus
with `w` or Escape restores the saved architecture view and focuses the map.

Every touched slab or building carries its task in a corner: the selected task
when it touches the element, else the first shown task in work order, with +N for
the other shown tasks; in progress in the brand green, to do plain, done dim, the
selected task bold. In the root map a task on a component stands on its container
row and a system carries only tasks that touch the system. The Work focus list has
one toggle per status with a mapped task: Space on its header shows or hides those
tasks on the map without changing the selection, scope or camera; the default and
final statuses start hidden. List folding and map visibility are independent.
The component Tasks tab shares browsing, folding and record opening, but has no
visibility controls. `t` focuses the hierarchy to change visibility. Escape
returns from a diff to its record; Escape from the record closes Work and returns
to the map. `w` also closes Work.

## Appearance

Every colour is the terminal's own: its default foreground and background, its
bright black for quiet frames and draft elements, palette red/green for diff
changes, and palette colors for code syntax. The brand green `#1D9E75` is used
for the selection, active flows, their endpoints, and active work. Nothing is
sampled from the palette, so switching the terminal theme recolours the viewer
live.

All surfaces and the ground between them are plain. Frames weigh by depth: an
island bold and rounded, a slab plain and rounded, a zone dim and square; the selection draws heavy in the
brand green. The name and kind glyph sit in the top border.

Observed architecture uses solid frames and routes; drafts use dashed ones.
Map navigation highlights only the selected element. Routes draw dim and thin
until explicitly highlighted by a flow or task; then they draw heavy in the brand green with an arrowhead at the target,
a port dot on the border cell of each end (none on a top border, where the name
sits) and a short label on or beside a route segment, clear of card and row text.
Paths avoid foreign cards. Where two
unlit routes cross, a junction glyph marks the crossing. A lit flow marches from
source to target while its cells stay fixed. Enter on a relationship row in the
details pane selects the other end of the already highlighted relationship.
Browsing a relationship row moves only its cursor. Space toggles its highlight;
Enter first highlights it and then follows it.

## Keys

- Arrow keys move selection or the focused side-pane cursor. They never move map focus into a side pane.
- Enter opens a container or task, toggles a flow, or folds a task status group.
- Space toggles a flow, or a task status's map visibility in the hierarchy only. Left/Right also fold task groups.
- Backspace returns from a container map to root.
- Tab changes the focused details pane's tabs. Escape returns focus to the map; a source file or diff first returns to its preceding view.
- `/` searches architecture; Enter keeps a match and Escape restores the prior view.
- `h` lists Groma revisions; Enter opens one and Escape returns to Current.
- `t` focuses the hierarchy and `d` focuses details; pressing the focused pane's key again folds it.
- `w` toggles Work focus, `s` steps a flow, and `x` clears it.
- `p` shows the project profile read-only in the details pane; `p` or Escape returns to the selection.
- `?` shows the keys box in the details pane, opening it if folded; `?` or Escape closes it.
- A mouse click on a hierarchy row or a map building selects it.
- `r` refreshes and Ctrl+C exits.

Refresh preserves valid architecture and task selections, map scope, pane state,
and camera. The current map-width layout stays stable across repaints.

The focused pane has an accented border and a heading that identifies where keys
go. The selected architecture stays green when another pane has focus. The footer
shows bracketed actions for the active pane and always exposes Help. See the
[interaction review examples](interaction-spec.md) for visual acceptance checks.

Up/Down and k/j move the same selection or reading cursor. The viewport stays
still while that row is visible and follows only at its top or bottom edge.
Returning from a source or diff keeps the parent reading position.
