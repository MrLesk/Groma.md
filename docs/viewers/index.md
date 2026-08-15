# Viewers

A viewer shows the one architecture world Groma core already has: observed
boxes, planned ghosts, and the relationships between them. People use a
viewer to judge a scan, change the architecture through Groma, and accept a
ghost after a scan has matched it.

Viewers are plugins. The TUI is one plugin, not the product. A web page or
an MCP app would be the same kind of plugin. Core never knows which surface
is showing the world.

```text
Groma core → world → viewer plugin
```

A viewer never reads architecture Markdown, walks `groma/` directories, or
lays the world out. It asks core for the world and projects it. When
someone changes architecture in a viewer, Groma writes the Markdown.

See [Creating a viewer plugin](creating-a-plugin.md) for the shared
boundary.

## Viewer plugins

- [TUI](tui/index.md)
- [Web](web/index.md)
