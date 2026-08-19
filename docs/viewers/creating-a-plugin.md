# Creating a viewer plugin

A viewer plugin is the adaptation boundary between one surface and Groma. It
projects the world core already computed. It does not own architecture,
identity, or layout.

Surface facts stay in the plugin: terminal cells, browser pixels, MCP app
chrome. They must not appear in Groma core or architecture Markdown.

```text
ArchitectureWorld → semanticView (semantic city) → viewer plugin → a person
```

## What every viewer does

- Show one world, one box per architecture ID. Planned IDs are ghosts.
- Let someone walk System Context, Containers, and Components without
  moving the architecture.
- Let someone ask Groma to add a part, record a required change, add an
  explanation, or `groma accept <id>` after a scan match.
- Leave when asked, without leaving presentation state in the model.

A viewer does not place boxes. A viewer does not edit `groma/` files
itself. Groma writes those files.

## The world

Core returns the merged observed and planned architecture, already laid
out, with origin annotations. For a requested C4 level and focus, the
shared `semanticView` derives the semantic city before the plugin runs:
roles, bounds, promoted endpoints, routes, labels, selection targets, and
focus scope. That city is the renderer input. A live host may replace it
after `groma scan --watch` folds. Keys, pointers, projection, camera, paint,
and widgets are plugin concerns.

The [TUI viewer](tui/index.md) is the first plugin. The [web
viewer](web/index.md) is the same interface for another surface. Neither
plugin is Groma core.
