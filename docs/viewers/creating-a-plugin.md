# Creating a viewer plugin

A viewer plugin is the adaptation boundary between one surface and Groma. It
projects the world core already computed. It does not own architecture,
identity, or layout.

Surface facts stay in the plugin: terminal cells, browser pixels, MCP app
chrome. Nothing in core or architecture Markdown depends on them.

```text
ArchitectureWorld → sheetScene (blueprint sheet) → TUI plugin
                                             └──→ Web plugin
```

## What every viewer does

- Show one world, one box per representation: an observed element and a
  plan's restatement of it are two boxes sharing one architecture ID.
  Planned IDs are ghosts.
- Let someone walk System Context, Containers, and Components without
  moving the architecture.
- Leave changes to `groma create`, `groma edit` and `groma accept`; no
  viewer edits architecture.
- Leave when asked, without leaving presentation state in the model.

A viewer does not place boxes or touch the filesystem. An interactive host may
ask core to save non-architecture project data, as the web host does for the
project profile; the viewer still cannot write architecture records.

## The world

Core returns the merged observed, planned and missing architecture with origin
annotations, then composes one `SheetScene`: islands, slabs, buildings, zones,
and lattice routes on whole cells. Both hosts give that fixed scene to their
viewer. Keys, pointers, projection, camera, paint, and widgets are plugin
concerns.

A live host reloads the architecture and composes a new sheet after a
`groma scan --watch` fold, an architecture Markdown change, or a manual
refresh. A Backlog task change updates only the work projected onto the cached
architecture and sheet; it does not lay the map out again.

## Lifecycle and contract

`groma view` calls `startTerminalViewer` in `src/view-host.ts`. The host loads
the annotated architecture, composes its sheet, projects the Backlog work read
so far with `projectActiveWork`, and mounts
`mountTerminalViewer(renderer, viewModel, { palette, onRefresh })`. It then
pulls work with `workSource.read()` and starts three watches: `watchScan` for
source folds, `watchArchitecture` for architecture Markdown, and
`workSource.watch` for Backlog task files.

Source, Markdown, and manual refreshes serialize architecture reloads and sheet
composition before calling the plugin's `update`. Work refreshes read Backlog
and call `update` with new markers over the cached map. When the plugin's
`closed` promise settles, the host stops all three watches. The host's
`destroy` marks the viewer closed, stops the watches and destroys the plugin;
its `refresh`, `update` and `setView` pass through to the plugin.

The TUI plugin is `mountTerminalViewer(renderer, viewModel, options)` in
`src/viewers/tui/terminal-viewer.ts`; `options` may carry `level`,
`currentId`, `camera`, `palette` and `onRefresh`. It returns a handle:

- `closed`: a promise that settles when the viewer leaves;
- `destroy()`: leaves, see below;
- `refresh()`: asks the host for the world again through `onRefresh`;
- `update(next)`: replaces the view model and repaints, keeping level,
  selection, focus and camera;
- `setView({ level, currentId, camera })`: moves the view without a key
  press; every field is optional.

Work comes through a `WorkSource` (`src/work/backlog.ts`): `read()`
resolves the configured workflow and available Backlog tasks, and
`watch(onChange)` returns a handle whose `close()` stops watching the task files. The default is
`createBacklogPlugin(repositoryRoot)`; both hosts take another source
through their `workSource` option.

Leave when asked means `destroy`, which Ctrl+C calls. The plugin marks
itself closed, removes its frame callback and key listener, settles
`closed`, and destroys the renderer, which restores the terminal. When
the renderer is destroyed from outside, the plugin releases the same way
without destroying it again. Level, selection, focus and camera live only
in the plugin's state; the world is never changed on the way out.

The [TUI viewer](tui/index.md) is one plugin. The [web
viewer](web/index.md) is another plugin over the same core; each surface
has its own start function, `startTerminalViewer` in `src/view-host.ts`
and `startWebViewer` in `src/viewers/web/server.ts`, wired in
`src/cli.ts`. `startWebViewer` returns `{ url, close }`; `close` stops the
watches, closes the event streams and stops the server. Neither plugin is
Groma core.
