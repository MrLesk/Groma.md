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

The root map is one row of islands west to east: the actors, each internal
system, and the external systems. An island lists one row per child in the
sheet's placement order: the kind glyph and name, then one block per component
(observed ▪, draft ▫ dim). An island is never wider than the map minus its side
padding; a longer row wraps its blocks and the island grows down. No count
appears on the map. Groups appear only in the container map. Relationships attach
to the nearest visible row when their authored endpoint is hidden.

Enter on a container row opens its map: the container fitted to the map width
and centered, its groups stacked as zones with the buildings wrapped into lines,
and the neighbouring containers of the same system peeking on both sides. Each
component stands as a building: its name and glyph in the top border, one row per
floor inside naming the floor's largest file with +N for the rest, dim; a draft
building shows one empty row in a dashed frame; the selected building draws heavy
in the brand green. An
endpoint in a peeking neighbour attaches to that slab; any other outside endpoint
attaches to the container itself. Backspace
returns to root with the container's row selected. Escape also returns to root
and closes details. No other element opens a map scope.

The terminal viewer reads the same sheet scene as the web viewer for what exists,
its order and its groups; it lays islands and containers out in its own columns
and rows.

## Camera and selection

The map has one readable scale. It has no fit-all state, zoom keys or zoom
readout. A wider terminal widens the fitted islands and container; a taller one
shows more rows.

At root, Up and Down walk the rows of an island, the island itself being one stop
above its first row; Left and Right cross to the neighbouring island, which
becomes centered with a short animated pan while its neighbours peek in the side
padding. In a container map the arrows follow the lines of buildings; Right past
the last building or Left past the first crosses to the neighbouring container
and selects its first building. A small world fits without wrapping or panning.
The map scrolls down and up only as far as a selection needs. Selection and
details never change the world layout; only the map width re-fits it. Stepping
a flow reveals its visible destination vertically the same way, without changing
selection or map scope.

The hierarchy and `/` search can select architecture outside the current scope.
Selecting a component opens its parent container; selecting any outer element
returns to root. The hierarchy uses `●` actor, `■` system, `▱` container, and `▪`
component glyphs, with `▾` and `▸` disclosure and `▌` for the current item.

## Details and flows

The details pane describes the current architecture selection.
While a flow row has hierarchy focus, it instead shows that flow and its current
leg. `]` closes or reopens the pane, reserving or releasing its columns. `t`
switches between what an architecture element does and how it is built.

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
stored architecture selection, map scope, camera, flow, or sheet geometry. Tasks
follow the configured workflow statuses. Up and Down select one task; Enter focuses
its task-list details: status, assignees, acceptance progress, modified files, and
references.

The selected task accents every element touched by its modified files and exact
architecture references, plus routes leaving those elements. If all touched elements
belong to one container, Work temporarily opens that component map. Otherwise it uses
the root map and promotes hidden components to their visible containers. The camera
keeps the selection's island or container centred and scrolls vertically to the
touched set. Closing Work focus with `w` or Escape restores the exact pre-Work view.

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
Active routes march from source to target while their geometry, labels, and
arrowheads remain fixed.

## Keys

- Arrow keys move selection or the focused side-pane cursor.
- Enter opens a container or focuses architecture, flow, or task details.
- Backspace returns from a container map to root.
- Tab moves between the hierarchy and map, or between tasks and task details in Work focus. Escape leaves the current focused mode.
- `/` searches architecture; Enter keeps a match and Escape restores the prior view.
- `w` toggles Work focus. `[` toggles the hierarchy, `]` the details, `t` changes the details tab, `s` steps a flow, and `x` clears it.
- `p` shows the project profile read-only in the details pane; `p` or Escape returns to the selection.
- A mouse click on a hierarchy row or a map building selects it.
- `r` refreshes and Ctrl+C exits.

Refresh preserves valid architecture and task selections, map scope, pane state,
and camera. The same world coordinates are projected after every repaint.
