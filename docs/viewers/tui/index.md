# Terminal viewer

Run `groma view` to scan the repository and inspect its architecture in a
terminal. The screen has a header, a hierarchy pane, a map, a details pane, and
a footer. Panes reserve their columns and never cover the map. They start folded
by width so the map keeps at least 60 columns: both open at 120 columns and
wider, the hierarchy alone from 90 to 119, none under 90. `[` folds or opens the
hierarchy and `]` the details at any width; with the details folded the footer
names the selection. Inside a container map the header shows the scope path with
the component count.

## Map scopes

The root map uses Core's sheet placement order to make a compact terminal
layout. It shows actor, internal-system, and external-system islands. A system
island lists one row per container and one block per component. Blocks wrap
inside the fitted island. Component cards, group zones, and container slabs stay
hidden at root. Relationships whose exact endpoint is hidden attach to its
visible row or island.

Enter on a container opens its fitted container map. It shows the container
slab, its group zones, and its component buildings, with the previous and next
containers peeking at the sides. Backspace returns to root with the container
selected. Escape also returns to root and closes details. No other element opens
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
neighbouring island. Inside a container, Left and Right read through wrapped
building rows and cross to the neighbouring container only at an end. Up and
Down prefer the nearest building in the same column. Arrows never open or leave
a container scope. The camera pans only enough vertically to reveal the
selection. Stepping a flow reveals its visible destination without changing
selection or map scope.

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

## Details and flows

The details pane describes the current architecture selection.
While a flow row has hierarchy focus, it instead shows that flow and its current
leg. `]` closes or reopens the pane, reserving or releasing its columns. `t`
switches between what an architecture element does and how it is built. In the
How tab the Code section lists each file with its line count and the declarations
under it in authored order; Enter on a declaration opens the source read-only at
that line. A task record's modified files open their unified diff. Escape returns.

The hierarchy lists actor flows above the architecture tree. Picking a flow lights
its visible promoted routes without hiding or moving unrelated architecture. The
architecture selection keeps its own marker. `s` advances to a leg, whose route
and visible destination carry the stronger treatment. When an exact endpoint is
hidden at root, the destination marker names it on its visible container and the
footer shows both names. `x` clears the flow.

## Work focus

The map always shows compact task markers on visible architecture anchors. A reserved
recap row at its bottom summarizes current work and points to `w`. Neither treatment
covers or changes the architecture canvas.

`w` gives the hierarchy and details panes to Backlog tasks without changing the
stored architecture selection, map scope, camera, flow, or map layout. Tasks
follow the configured workflow statuses. Up and Down select one task; Enter focuses
its task-list details: status, assignees, acceptance progress, modified files, and
references.

The selected task accents every element touched by its modified files and exact
architecture references, plus routes leaving those elements. If all touched elements
belong to one container, Work temporarily opens that component map. Otherwise it uses
the root map and promotes hidden components to their visible containers. The camera
reveals the touched set without rearranging it. Closing Work focus
with `w` or Escape restores the exact pre-Work view.

Every touched slab or building carries its task in a corner: the selected task
when it touches the element, else the first shown task in work order, with +N for
the other shown tasks; in progress in the brand green, to do plain, done dim, the
selected task bold. In the root map a task on a component stands on its container
row and a system carries only tasks that touch the system. The Work focus list has
one toggle per status with a mapped task: Enter on its header shows or hides those
tasks on the map, in the corners and in the recap marks without changing the
selection, scope or camera; the default and final statuses start hidden. The recap
row counts every status and marks the shown ones. The details pane lists the tasks
touching the selection under To do, In progress and Done with their acceptance
progress; Enter on one opens its full record and Escape returns.

## Appearance

Every colour is the terminal's own: its default foreground and background, its
bright black for quiet frames and draft elements, and the brand green `#1D9E75`
for the selection, active flows, their endpoints, and active work. Nothing is
sampled from the palette, so switching the terminal theme recolours the viewer
live.

Surfaces carry the pattern of their kind, dim: a slab a grain, a zone a hatch, a
system island plain; the ground between them stays plain. Frames weigh by depth: an
island bold, a slab plain, a zone dim and dashed; the selection draws heavy in the
brand green. The name and kind glyph sit in the top border.

Observed architecture uses solid frames and routes; drafts use dashed ones.
Routes draw dim and thin until they touch the selection, a lit flow or a task's
element; then they draw heavy in the brand green with an arrowhead at the target,
a port dot on the border cell of each end (none on a top border, where the name
sits) and a label on their longest run when it fits over plain ground. Where two
unlit routes cross, a junction glyph marks the crossing. A lit flow marches from
source to target while its cells stay fixed. Enter on a relationship row in the
details pane lights that route alone and names both ends; Enter again selects the
other end.

## Keys

- Arrow keys move selection or the focused side-pane cursor.
- Enter opens a container or focuses architecture, flow, or task details.
- Backspace returns from a container map to root.
- Tab moves between the hierarchy and map, or between tasks and task details in Work focus. Escape leaves the current focused mode.
- `/` searches architecture; Enter keeps a match and Escape restores the prior view.
- `h` lists Groma revisions; Enter opens one and Escape returns to Current.
- `w` toggles Work focus. `[` toggles the hierarchy, `]` the details, `t` changes the details tab, `s` steps a flow, and `x` clears it.
- `p` shows the project profile read-only in the details pane; `p` or Escape returns to the selection.
- `?` shows the keys box in the details pane, opening it if folded; `?` or Escape closes it.
- A mouse click on a hierarchy row or a map building selects it.
- `r` refreshes and Ctrl+C exits.

Refresh preserves valid architecture and task selections, map scope, pane state,
and camera. The current map-width layout stays stable across repaints.
