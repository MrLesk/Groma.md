# Terminal viewer

Run `groma view` to scan the repository and inspect its architecture in a
terminal. The screen has a header, a persistent hierarchy pane, a map, an
optional details pane, and a footer. Panes reserve their columns and never cover
the map.

## Map scopes

The root map shows actors, internal systems and their containers, collapsed named
groups, and external systems. Component cards are hidden. Relationships attach to
the nearest visible architecture element when their authored endpoint is hidden.

Enter opens a selected container. That scope shows the container boundary, its
named groups, and its direct components. An endpoint outside the container attaches
to the container boundary. Backspace returns to root with the container selected.
Escape also returns to root and closes details. No other element opens a map
scope.

The terminal viewer consumes the same sheet scene as the web viewer. It keeps
that scene immutable while translating sheet cells and routes into terminal
columns and rows.

## Camera and selection

The map has one readable scale. It has no fit-all state, zoom keys, zoom readout,
or camera animation. A larger terminal reveals more of the same canvas.

Arrow keys follow visual rows and columns without changing scope. Each system
boundary is one navigation step: moving inward stops on the system before a
second press reaches the first child edge along that path; the entry ray breaks
equal-edge ties. Moving outward stops on the system before a second press leaves
it. Same-lane siblings still win within a boundary. When the
selected element would leave the map pane, the camera pans only enough to reveal
it. The same rule applies left, right, up, and down. Selection, pane changes,
and details never change world geometry. Stepping a flow uses the same minimal
pan to reveal its visible destination without changing architecture selection
or map scope.

The hierarchy and `/` search can select architecture outside the current scope.
Selecting a component opens its parent container; selecting any outer element
returns to root. The hierarchy uses `●` actor, `■` system, `▱` container, and `▪`
component glyphs, with `▾` and `▸` disclosure and `▌` for the current item.

## Details and flows

The details pane opens by default and describes the current architecture selection.
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
its details, including status, assignees, description, acceptance criteria, modified
files, and references.

The selected task accents every element touched by its modified files and exact
architecture references, plus routes leaving those elements. If all touched elements
belong to one container, Work temporarily opens that component map. Otherwise it uses
the root map and promotes hidden components to their visible containers. The camera
frames the complete visible touched set at the same fixed scale. Closing Work focus
with `w` or Escape restores the exact pre-Work view.

## Appearance

Neutral surface shades are mixed from the terminal foreground and background, so
light and dark terminal themes keep their own contrast. Actors, systems,
containers, groups, components, and external systems use distinct grayscale
fills and frames. Observed, planned, and missing architecture uses solid,
dashed, and dotted treatment.

The terminal green is the map's only chromatic accent. It marks selection, active
flows, their endpoints, and active work. Active routes march from source to
target while their geometry, labels, and arrowheads remain fixed.

## Keys

- Arrow keys move selection or the focused side-pane cursor.
- Enter opens a container or focuses architecture, flow, or task details.
- Backspace returns from a container map to root.
- Tab moves between the hierarchy and map, or between tasks and task details in Work focus. Escape leaves the current focused mode.
- `/` searches architecture; Enter keeps a match and Escape restores the prior view.
- `w` toggles Work focus. `]` toggles details, `t` changes its architecture tab, `s` steps a flow, and `x` clears it.
- `r` refreshes and Ctrl+C exits.

Refresh preserves valid architecture and task selections, map scope, pane state,
and camera. The same world coordinates are projected after every repaint.
