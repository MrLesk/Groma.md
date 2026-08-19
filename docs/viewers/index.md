# Viewers

A viewer shows the one architecture world Groma core already has: observed
boxes, planned ghosts, and the relationships between them. People use a
viewer to judge a scan, change the architecture through Groma, and accept a
ghost after a scan has matched it.

Viewers are plugins. The TUI is one plugin, not the product. A web page or
an MCP app would be the same kind of plugin. Core never knows which surface
is showing the world.

```text
ArchitectureWorld → semanticView (semantic city) → renderer plugin
```

A C4 level is one campus. Software wrappers keep the world-layout
union size, from code up. Camera scale is the only shrink. The level
names that layer of internal software and keeps the next software layer
as unnamed underlay. People and external systems are marks: they keep
their world origin, and their drawn size follows the named level. Ghost
means planned. Underlay is not a ghost. Entering a system does not move
that system, its people, or sibling systems. A relationship between
nested endpoints attaches to the named software, mark, or campus wrapper
above them, never to underlay. The TUI map and the web SVG campus paint
this view. When the camera is on a named system, that title docks in
screen space and the system's containers become the named level.

A viewer never reads architecture Markdown, walks `groma/` directories, or
lays the world out. Core first derives one semantic city from the world for
the requested level and focus. That city owns the visible items and roles,
promoted relationship endpoints, projection-independent routes and labels,
selection targets, and focus scope. A live
viewer starts the same watch as `groma scan --watch` in-process and applies
each new world after a fold. It also reloads the world when architecture
Markdown changes. It does not scan on open. The world
and semantic city are maps: selecting an item or opening details does not lay
either one out again.
The first view fits the whole map. Zooming in stops at one cell per world
unit so names stay readable. Routes stay on the map. One authored relationship is one route. Parents
are connected because a child is; viewers do not need a second row.
A relationship description is drawn on its route only while the
selection is an endpoint or an ancestor of exactly one endpoint.
When someone changes architecture in a viewer, Groma writes the Markdown.

The Web scene renderer boundary is deliberately narrow. Projection, camera,
paint, hit testing, interaction, and playback belong to the Web surface.
Visibility, endpoint promotion, route and label geometry, selection targets,
focus scope, and world-layout bounds belong to Core's semantic city. The Web
renderer may not recompute C4 disclosure or attach a relationship to a
different endpoint.

See [Creating a viewer plugin](creating-a-plugin.md) for the shared
boundary.

## Viewer plugins

- [TUI](tui/index.md)
- [Web](web/index.md)
