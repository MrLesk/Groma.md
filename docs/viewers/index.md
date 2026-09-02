# Viewers

A viewer shows the one architecture world Groma core already has: observed
boxes, draft ghosts, and the relationships between them.
People use a viewer to judge a scan and walk the architecture. Changes and
ghost acceptance go through `groma draft`, `groma edit` and
`groma accept`.

Viewers are plugins. The TUI is one plugin, not the product. A web page or
an MCP app would be the same kind of plugin. Core never knows which surface
is showing the world.

```text
ArchitectureWorld → sheetScene (blueprint sheet) → TUI plugin
                                             └──→ Web plugin
```

The sheet lays out the whole architecture once. The TUI projects it from above
at one fixed readable scale. Its root scope shows actors, internal-system
boundaries, container slabs, collapsed groups, and external systems. Entering a
container shows that boundary, its groups, and its component buildings. Hidden
relationship endpoints promote to the nearest visible boundary without moving
the sheet.

The web map paints the whole world at once as one isometric blueprint
sheet: flat islands for actors, external systems and each internal system,
low container slabs, buildings (components whose height and shape follow
the observed code, round buildings for actors, pills for external
systems), and one lattice route per authored relationship.

A viewer never reads architecture Markdown, walks `groma/` directories, or
lays the world out. Core composes the blueprint sheet before either viewer
receives it; the sheet owns every footprint, floor, shape, zone, and route on
whole cells. A live host starts the same watch as `groma scan --watch`
in-process and reloads the architecture and sheet after each fold. It also
reloads them when architecture Markdown changes. `groma view` and `groma web` run one scan before opening.
A live host asks the embedded Backlog work-source plugin for active tasks and
refreshes them when a task file
changes: the TUI marks In Progress work on referenced elements, while the web
stands each task's pins on the element it touched last. A work refresh projects
onto the cached map instead of composing another sheet. A failed Backlog read
leaves the map available. A missing global Backlog.md CLI supplies empty work.
Selection and details never lay anything out again.
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

Both plugins share command flows, the route-text rule, sibling order and the
containment tree from `src/viewers/` and `src/element-order.ts`. A command is
an authored relationship exposed as something an actor can start. A flow is
the viewer-derived walk from one command through every reachable outgoing
relationship, optionally limited to one starting actor. A leg is one authored
relationship in that walk. Commands and legs belong to the architecture world;
flows are viewer state and are not new architecture elements.

See [Creating a viewer plugin](creating-a-plugin.md) for the shared
boundary.

## Viewer plugins

- [TUI](tui/index.md)
- [Web](web/index.md)
