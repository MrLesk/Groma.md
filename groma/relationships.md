---
type: Groma Relationships
title: Architecture relationships
---

## Relationships

| Source | Target | Description | Technology |
| --- | --- | --- | --- |
| [src/cli.ts](../src/cli.ts) | [src/scanner.ts](../src/scanner.ts) | Starts scans | Function call |
| [src/cli.ts](../src/cli.ts) | [src/viewers/web/server.ts](../src/viewers/web/server.ts) | Starts the browser map | Function call |
| [src/cli.ts](../src/cli.ts) | [src/view-host.ts](../src/view-host.ts) | Starts the terminal map | Function call |
| [src/cli.ts](../src/cli.ts) | [src/viewers/web/export.ts](../src/viewers/web/export.ts) | Exports static maps | Function call |
| [src/scanner.ts](../src/scanner.ts) | [src/scanner/registry.ts](../src/scanner/registry.ts) | Collects scanner results | Function call |
| [src/scanner.ts](../src/scanner.ts) | [src/scan-reconciler.ts](../src/scan-reconciler.ts) | Reconciles scan results | Function call |
| [src/scan-reconciler.ts](../src/scan-reconciler.ts) | [src/markdown-emitter.ts](../src/markdown-emitter.ts) | Writes architecture records | Function call |
| [src/scan-reconciler.ts](../src/scan-reconciler.ts) | [src/relationship-inference.ts](../src/relationship-inference.ts) | Derives relationships | Function call |
| [src/scan-reconciler.ts](../src/scan-reconciler.ts) | [src/architecture-findings.ts](../src/architecture-findings.ts) | Finds possible duplicates | Function call |
| [src/scanner/session.ts](../src/scanner/session.ts) | [src/scanner/source-watch.ts](../src/scanner/source-watch.ts) | Watches source changes | Function call |
| [src/scanner/session.ts](../src/scanner/session.ts) | [src/scanner/modules/settings.ts](../src/scanner/modules/settings.ts) | Manages scanner settings | Function call |
| [src/viewers/web/data.ts](../src/viewers/web/data.ts) | [src/viewers/web/map-session.ts](../src/viewers/web/map-session.ts) | Reads and writes live data | HTTP and server events |
| [src/viewers/web/map-session.ts](../src/viewers/web/map-session.ts) | [src/scanner/session.ts](../src/scanner/session.ts) | Runs live scans | Function call |
| [src/viewers/web/map-session.ts](../src/viewers/web/map-session.ts) | [src/authoring.ts](../src/authoring.ts) | Applies browser edits | Function call |
| [src/viewers/web/map-session.ts](../src/viewers/web/map-session.ts) | [plugins/work-sources/backlog/src/index.ts](../plugins/work-sources/backlog/src/index.ts) | Reads and watches tasks | Work source plugin |
| [src/view-host.ts](../src/view-host.ts) | [plugins/work-sources/backlog/src/index.ts](../plugins/work-sources/backlog/src/index.ts) | Reads and watches tasks | Work source plugin |
| [src/view-host.ts](../src/view-host.ts) | [src/scanner/session.ts](../src/scanner/session.ts) | Runs live scans | Function call |
| [src/viewers/web/runtime.ts](../src/viewers/web/runtime.ts) | [src/sheet/scene.ts](../src/sheet/scene.ts) | Lays out the map | Function call |
| [plugins/scanners/csharp/src/adapter.ts](../plugins/scanners/csharp/src/adapter.ts) | [plugins/scanners/csharp/dotnet/Program.cs](../plugins/scanners/csharp/dotnet/Program.cs) | Runs C# analysis | Child process and JSON |
| [plugins/scanners/csharp/dotnet/Command.cs](../plugins/scanners/csharp/dotnet/Command.cs) | [plugins/scanners/csharp/dotnet/Scanner.cs](../plugins/scanners/csharp/dotnet/Scanner.cs) | Runs compiler analysis | Function call |
| [plugins/scanners/go/src/adapter.ts](../plugins/scanners/go/src/adapter.ts) | [plugins/scanners/go/worker/main.go](../plugins/scanners/go/worker/main.go) | Runs Go analysis | Child process and JSON |
| [plugins/scanners/rust/src/index.ts](../plugins/scanners/rust/src/index.ts) | [plugins/scanners/rust/native/src/main.rs](../plugins/scanners/rust/native/src/main.rs) | Runs Rust analysis | Child process and JSON |
| [Developer](actors/developer.md) | [Command interface](systems/groma-md/containers/cli/components/src-cli.md) | Runs Groma commands | Groma CLI |
| [Developer](actors/developer.md) | [Task changes panel](systems/groma-md/containers/export/components/task-diff-control.md) | Reviews task changes | Browser UI |
| [Developer](actors/developer.md) | [Revision selector](systems/groma-md/containers/export/components/revision-control.md) | Browses past revisions | Browser UI |
| [plugins/work-sources/backlog/src/index.ts](../plugins/work-sources/backlog/src/index.ts) | [Backlog.md](externals/backlog-md.md) | Reads and watches tasks | Backlog CLI and JSON |
| [src/history/revisions.ts](../src/history/revisions.ts) | [Git](externals/git.md) | Reads past revisions | Git CLI |
| [src/scanner/modules/published.ts](../src/scanner/modules/published.ts) | [Scanner package registry](externals/scanner-package-registry.md) | Reads scanner releases | HTTP registry API |
| [src/scanner/modules/package.ts](../src/scanner/modules/package.ts) | [Scanner package registry](externals/scanner-package-registry.md) | Downloads scanner packages | Bun install and npm registry protocol |
| [src/cli.ts](../src/cli.ts) | [src/authoring.ts](../src/authoring.ts) | Dispatches architecture edits | Function call |
| [src/edit.ts](../src/edit.ts) | [src/markdown-emitter.ts](../src/markdown-emitter.ts) | Writes architecture records | Function call |
| [src/scanner/cli.ts](../src/scanner/cli.ts) | [src/scanner/modules/inventory.ts](../src/scanner/modules/inventory.ts) | Installs and updates scanners | Function call |
| [src/viewers/web/task-diff/control.ts](../src/viewers/web/task-diff/control.ts) | [src/viewers/web/data.ts](../src/viewers/web/data.ts) | Loads task changes | Bound function calls |
| [src/viewers/web/revision/control.ts](../src/viewers/web/revision/control.ts) | [src/viewers/web/data.ts](../src/viewers/web/data.ts) | Loads past revisions | Function call |
| [src/viewers/web/map-session.ts](../src/viewers/web/map-session.ts) | [src/history/revisions.ts](../src/history/revisions.ts) | Loads past revisions | Function call |
| [Coding agent](actors/coding-agent.md) | [Command interface](systems/groma-md/containers/cli/components/src-cli.md) | Curates architecture | Groma CLI |
| [src/cli.ts](../src/cli.ts) | [src/lint-command.ts](../src/lint-command.ts) | Registers the lint command | Function call |
| [src/viewers/web/page.ts](../src/viewers/web/page.ts) | [src/viewers/web/sharing/metadata.ts](../src/viewers/web/sharing/metadata.ts) | Embeds sharing metadata | Function call |
| [src/viewers/web/export.ts](../src/viewers/web/export.ts) | [src/viewers/web/sharing/images.ts](../src/viewers/web/sharing/images.ts) | Writes cover images | Function call |
| [src/viewers/web/map-session.ts](../src/viewers/web/map-session.ts) | [src/viewers/web/sharing/images.ts](../src/viewers/web/sharing/images.ts) | Renders cover images | Function call |
| [src/viewers/web/server.ts](../src/viewers/web/server.ts) | [src/viewers/web/startup/progress.ts](../src/viewers/web/startup/progress.ts) | Reports startup progress | Function call |
| [src/viewers/web/render.ts](../src/viewers/web/render.ts) | [src/viewers/web/iso/painting/map.ts](../src/viewers/web/iso/painting/map.ts) | Draws the map | Function call |

## Derived relationships

| Source | Target | Description | Technology |
| --- | --- | --- | --- |
| [src/architecture-watch.ts](../src/architecture-watch.ts) | [src/view-host.ts](../src/view-host.ts) | Invokes supplied callback: onChange | typescript |
| [src/architecture-watch.ts](../src/architecture-watch.ts) | [src/viewers/tui/scanner-settings.ts](../src/viewers/tui/scanner-settings.ts) | Invokes supplied callback: onChange | typescript |
| [src/architecture-watch.ts](../src/architecture-watch.ts) | [src/viewers/web/export.ts](../src/viewers/web/export.ts) | Invokes supplied callback: onChange | typescript |
| [src/architecture-watch.ts](../src/architecture-watch.ts) | [src/viewers/web/map-session.ts](../src/viewers/web/map-session.ts) | Invokes supplied callback: onChange | typescript |
| [src/init-command.ts](../src/init-command.ts) | [src/cli.ts](../src/cli.ts) | Invokes supplied callback: openWeb | typescript |
| [src/scanner.ts](../src/scanner.ts) | [src/cli.ts](../src/cli.ts) | Invokes supplied callback: onFold | typescript |
| [src/scanner/session.ts](../src/scanner/session.ts) | [src/view-host.ts](../src/view-host.ts) | Invokes supplied callbacks: onFold, onSettings | typescript |
| [src/scanner/session.ts](../src/scanner/session.ts) | [src/viewers/web/map-session.ts](../src/viewers/web/map-session.ts) | Invokes supplied callbacks: onFold, onSettings, watchesFile | typescript |
| [src/scanner/source-watch.ts](../src/scanner/source-watch.ts) | [src/cli.ts](../src/cli.ts) | Invokes supplied callback: onError | typescript |
| [src/scanner/source-watch.ts](../src/scanner/source-watch.ts) | [src/scanner.ts](../src/scanner.ts) | Invokes supplied callback: onObservations | typescript |
| [src/scanner/source-watch.ts](../src/scanner/source-watch.ts) | [src/scanner/session.ts](../src/scanner/session.ts) | Invokes supplied callbacks: onError, onObservations | typescript |
| [src/viewers/tui/panes/screen.ts](../src/viewers/tui/panes/screen.ts) | [src/viewers/tui/terminal-viewer.ts](../src/viewers/tui/terminal-viewer.ts) | Invokes supplied callbacks: onHierarchyRow, onMapCell | typescript |
| [src/viewers/web/atoms/settings-dialog.ts](../src/viewers/web/atoms/settings-dialog.ts) | [src/viewers/web/review/control.ts](../src/viewers/web/review/control.ts) | Invokes supplied callback: onClose | typescript |
| [src/viewers/web/authoring.ts](../src/viewers/web/authoring.ts) | [src/viewers/web/render.ts](../src/viewers/web/render.ts) | Invokes supplied callbacks: live, world | typescript |
| [src/viewers/web/iso/camera/layer.ts](../src/viewers/web/iso/camera/layer.ts) | [src/viewers/web/iso/painting/map.ts](../src/viewers/web/iso/painting/map.ts) | Invokes supplied callbacks: drawCamera, moveStarted, settled | typescript |
| [src/viewers/web/iso/camera/pointer.ts](../src/viewers/web/iso/camera/pointer.ts) | [src/viewers/web/render.ts](../src/viewers/web/render.ts) | Invokes supplied callbacks: editProject, orbit, orbiting, pan, select, zoom | typescript |
| [src/viewers/web/review/control.ts](../src/viewers/web/review/control.ts) | [src/viewers/web/render.ts](../src/viewers/web/render.ts) | Invokes supplied callback: world | typescript |
| [src/viewers/web/search/session.ts](../src/viewers/web/search/session.ts) | [src/viewers/web/render.ts](../src/viewers/web/render.ts) | Invokes supplied callbacks: anchorOf, apply, openTask, previewMap, snapshot, taskElements | typescript |
| [src/viewers/web/source/control.ts](../src/viewers/web/source/control.ts) | [src/viewers/web/render.ts](../src/viewers/web/render.ts) | Invokes supplied callbacks: comparison, element, from, repaint, revision | typescript |
| [src/viewers/web/task-diff/control.ts](../src/viewers/web/task-diff/control.ts) | [src/viewers/web/render.ts](../src/viewers/web/render.ts) | Invokes supplied callbacks: repaint, world | typescript |
