# Viewers

A viewer shows the one architecture world Groma core already has: observed
boxes, planned ghosts, missing items, and the relationships between them.
People use a viewer to judge a scan and walk the architecture. Changes and
ghost acceptance go through `groma create`, `groma edit` and
`groma accept`.

Viewers are plugins. The TUI is one plugin, not the product. A web page or
an MCP app would be the same kind of plugin. Core never knows which surface
is showing the world.

```text
ArchitectureWorld → semanticView (semantic city) → TUI plugin
ArchitectureWorld → sheetScene (blueprint sheet) → Web plugin
```

A C4 level is one campus. Software wrappers keep the world-layout
union size, from code up. Camera scale is the only shrink. The level
names that layer of internal software and keeps the next software layer
as unnamed underlay. People and external systems are marks: they keep
their world origin, and their drawn size follows the named level. Ghost
means planned. Underlay is not a ghost. Entering a system does not move
that system, its people, or sibling systems. A relationship between
nested endpoints attaches to the named software, mark, or campus wrapper
above them, never to underlay. The TUI map paints this view. Entering a
system makes its containers the named level. When a boundary's top edge
scrolls above the map pane, its title docks on the pane's top row.

The web map paints the whole world at once as one isometric blueprint
sheet: flat islands for people, external systems and each internal system,
low container slabs, buildings (components whose height and shape follow
the observed code, round buildings for people, pills for external
systems), and one lattice route per authored relationship.

A viewer never reads architecture Markdown, walks `groma/` directories, or
lays the world out. For the web, core composes the blueprint sheet before
the page receives it; the sheet owns every footprint, floor, shape, zone
and route on whole cells. For the TUI, the plugin asks core's
`semanticView` for the city of its current level and focus on every
repaint; the city owns the visible items, their roles and drawn sizes,
and the promoted relationship endpoints. A live
viewer starts the same watch as `groma scan --watch` in-process and applies
each new world after a fold. It also reloads the world when architecture
Markdown changes. It does not scan on open. A live viewer also reads the
active Backlog tasks and refreshes them when a task file changes: the TUI
marks In Progress work on the elements a task references, the web stands
each task's pins on the element it touched last. A Backlog read that
fails counts as no work. The world
and its maps are maps: selecting an item or opening details does not lay
anything out again.
The first view fits the whole map. Routes stay on the map. One authored
relationship is one route; on the TUI, relationships that promote to the
same pair of items at a level share one route. Parents
are connected because a child is; viewers do not need a second row.
On the TUI the first word of a relationship description (the first two at
Components) is drawn on its route while the selection is an endpoint or an
ancestor of exactly one endpoint, or while the route is on the lit walk;
on the web the whole description is the route's tooltip.

The Web renderer boundary is deliberately narrow. Projection, camera,
paint, hit testing, selection and the lit flow belong to the Web surface.
Footprints, floors, shapes, islands, zones, slabs and lattice routes belong
to Core's sheet; the web server ships the world, its sheet, the active
Backlog tasks and their pins together as one payload. The
Web renderer may not move a footprint or reroute a relationship.

Both plugins share the command walks, the route-text rule, sibling order
and the containment tree from `src/viewers/` and `src/element-order.ts`.

See [Creating a viewer plugin](creating-a-plugin.md) for the shared
boundary.

## Viewer plugins

- [TUI](tui/index.md)
- [Web](web/index.md)
