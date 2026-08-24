# Terminal viewer

Run `groma view` to inspect architecture in a terminal. The screen has a header,
a persistent hierarchy pane, a map, an optional details pane, and a footer. Panes
reserve their columns and never cover the map.

## Map scopes

The root map shows actors, internal systems and their containers, collapsed named
groups, and external systems. Component cards are hidden. Relationships attach to
the nearest visible architecture element when their authored endpoint is hidden.

Enter opens a selected container. That scope shows the container boundary, its
named groups, and its direct components. An endpoint outside the container attaches
to the container boundary. Backspace returns to root with the container selected.
No other element opens a map scope.

ELK currently supplies box bounds and routes. The terminal projection does not
interpret or improve that placement.

## Camera and selection

The map has one readable scale. It has no fit-all state, zoom keys, zoom readout,
or camera animation. A larger terminal reveals more of the same canvas.

Arrow keys select the nearest visible peer in their direction without changing
scope. When the selected element would leave the map pane, the camera pans only
enough to reveal it. Selection, pane changes, and details never change world
geometry.

The hierarchy and `/` search can select architecture outside the current scope.
Selecting a component opens its parent container; selecting any outer element
returns to root. The hierarchy uses `●` actor, `■` system, `□` container, and `▪`
component glyphs, with `▾` and `▸` disclosure and `▌` for the current item.

## Details and flows

The details pane opens by default and always describes the current selection. `]`
closes or reopens it, reserving or releasing its columns. `t` switches between
what the element does and how it is built.

The hierarchy lists actor flows above the architecture tree. Picking a flow lights
its visible promoted routes without hiding or moving unrelated architecture. `s`
steps through the flow and `x` clears it.

## Appearance

Neutral shades are mixed from the terminal foreground and background, so light
and dark terminal themes keep their own contrast. Kind remains visible without
color: actors use dots, systems a clean surface, containers grain, groups diagonal
hatch, and external systems crosses. Observed, planned, and missing architecture
uses solid, dashed, and dotted treatment.

The terminal green is the map's only chromatic accent. It marks selection, active
flows, their endpoints, and active work.

## Keys

- Arrow keys move selection or the focused side-pane cursor.
- Enter opens a container or focuses details for another element.
- Backspace returns from a container map to root.
- Tab moves between the hierarchy and map; Escape returns side-pane focus to map.
- `/` searches architecture; Enter keeps a match and Escape restores the prior view.
- `]` toggles details, `t` changes its tab, `s` steps a flow, and `x` clears it.
- `r` refreshes and Ctrl+C exits.

Refresh preserves a valid selection, map scope, pane state, and camera. The same
world coordinates are projected after every repaint.
