---
type: Groma Relationships
title: Architecture relationships
---

## Relationships

| Source | Target | Description | Technology |
| --- | --- | --- | --- |
| [src/cli.ts](../src/cli.ts) | [src/scanner.ts](../src/scanner.ts) | Starts the requested source scan | Function call |
| [src/cli.ts](../src/cli.ts) | [src/viewers/web/server.ts](../src/viewers/web/server.ts) | Starts the local web server | Function call |
| [src/cli.ts](../src/cli.ts) | [src/view-host.ts](../src/view-host.ts) | Starts the terminal viewer | Function call |
| [src/cli.ts](../src/cli.ts) | [src/viewers/web/export.ts](../src/viewers/web/export.ts) | Writes the static browser export | Function call |
| [src/scanner.ts](../src/scanner.ts) | [src/scanner/registry.ts](../src/scanner/registry.ts) | Collects results from the selected scanners | Function call |
| [src/scanner.ts](../src/scanner.ts) | [src/scan-reconciler.ts](../src/scan-reconciler.ts) | Applies successful scanner results to the architecture | Function call |
| [src/scan-reconciler.ts](../src/scan-reconciler.ts) | [src/markdown-emitter.ts](../src/markdown-emitter.ts) | Writes source ownership and architecture records | Function call |
| [src/scan-reconciler.ts](../src/scan-reconciler.ts) | [src/relationship-inference.ts](../src/relationship-inference.ts) | Refreshes relationships from the source evidence | Function call |
| [src/scan-reconciler.ts](../src/scan-reconciler.ts) | [src/architecture-findings.ts](../src/architecture-findings.ts) | Checks source operations for possible copies | Function call |
| [src/scanner/session.ts](../src/scanner/session.ts) | [src/scanner/source-watch.ts](../src/scanner/source-watch.ts) | Subscribes to source changes for the open viewer | Function call |
| [src/scanner/session.ts](../src/scanner/session.ts) | [src/scanner/modules/settings.ts](../src/scanner/modules/settings.ts) | Reads and changes project scanner settings | Function call |
| [src/viewers/web/data.ts](../src/viewers/web/data.ts) | [src/viewers/web/map-session.ts](../src/viewers/web/map-session.ts) | Reads live data and sends architecture or scanner changes | HTTP and server events |
| [src/viewers/web/map-session.ts](../src/viewers/web/map-session.ts) | [src/scanner/session.ts](../src/scanner/session.ts) | Starts and updates the live scanner session | Function call |
| [src/viewers/web/map-session.ts](../src/viewers/web/map-session.ts) | [src/authoring.ts](../src/authoring.ts) | Applies the architecture changes sent by the browser | Function call |
| [src/viewers/web/map-session.ts](../src/viewers/web/map-session.ts) | [plugins/work-sources/backlog/src/index.ts](../plugins/work-sources/backlog/src/index.ts) | Reads tasks and subscribes to task changes | Work source plugin |
| [src/view-host.ts](../src/view-host.ts) | [plugins/work-sources/backlog/src/index.ts](../plugins/work-sources/backlog/src/index.ts) | Reads tasks and subscribes to task changes | Work source plugin |
| [src/view-host.ts](../src/view-host.ts) | [src/scanner/session.ts](../src/scanner/session.ts) | Starts the scanner session for the terminal viewer | Function call |
| [src/viewers/web/runtime.ts](../src/viewers/web/runtime.ts) | [src/sheet/scene.ts](../src/sheet/scene.ts) | Builds the shared map layout | Function call |
| [src/viewers/web/render.ts](../src/viewers/web/render.ts) | [src/viewers/web/iso/map.ts](../src/viewers/web/iso/map.ts) | Draws the current map and selection | Function call |
| [plugins/scanners/csharp/src/adapter.ts](../plugins/scanners/csharp/src/adapter.ts) | [plugins/scanners/csharp/dotnet/Program.cs](../plugins/scanners/csharp/dotnet/Program.cs) | Starts C# analysis and reads its result | Child process and JSON |
| [plugins/scanners/csharp/dotnet/Command.cs](../plugins/scanners/csharp/dotnet/Command.cs) | [plugins/scanners/csharp/dotnet/Scanner.cs](../plugins/scanners/csharp/dotnet/Scanner.cs) | Runs the requested compiler analysis | Function call |
| [plugins/scanners/go/src/adapter.ts](../plugins/scanners/go/src/adapter.ts) | [plugins/scanners/go/worker/main.go](../plugins/scanners/go/worker/main.go) | Starts Go analysis and reads its result | Child process and JSON |
| [plugins/scanners/rust/src/index.ts](../plugins/scanners/rust/src/index.ts) | [plugins/scanners/rust/native/src/main.rs](../plugins/scanners/rust/native/src/main.rs) | Starts Rust analysis and reads its result | Child process and JSON |
| [src/cli.ts](../src/cli.ts) | [src/lint-command.ts](../src/lint-command.ts) | Registers the lint command on the shared CLI program | Function call |

## Derived relationships

| Source | Target | Description | Technology |
| --- | --- | --- | --- |
| [src/architecture-watch.ts](../src/architecture-watch.ts) | [src/view-host.ts](../src/view-host.ts) | Invokes supplied onChange callback | typescript |
| [src/architecture-watch.ts](../src/architecture-watch.ts) | [src/viewers/tui/scanner-settings.ts](../src/viewers/tui/scanner-settings.ts) | Invokes supplied onChange callback | typescript |
| [src/architecture-watch.ts](../src/architecture-watch.ts) | [src/viewers/web/export.ts](../src/viewers/web/export.ts) | Invokes supplied onChange callback | typescript |
| [src/architecture-watch.ts](../src/architecture-watch.ts) | [src/viewers/web/map-session.ts](../src/viewers/web/map-session.ts) | Invokes supplied onChange callback | typescript |
| [src/init-command.ts](../src/init-command.ts) | [src/cli.ts](../src/cli.ts) | Invokes supplied openViewer callback | typescript |
| [src/scanner.ts](../src/scanner.ts) | [src/cli.ts](../src/cli.ts) | Invokes supplied onFold callback | typescript |
| [src/scanner/session.ts](../src/scanner/session.ts) | [src/view-host.ts](../src/view-host.ts) | Invokes supplied onFold callback; Invokes supplied onSettings callback | typescript |
| [src/scanner/session.ts](../src/scanner/session.ts) | [src/viewers/web/map-session.ts](../src/viewers/web/map-session.ts) | Invokes supplied onFold callback; Invokes supplied onSettings callback | typescript |
| [src/scanner/source-watch.ts](../src/scanner/source-watch.ts) | [src/cli.ts](../src/cli.ts) | Invokes supplied onError callback | typescript |
| [src/scanner/source-watch.ts](../src/scanner/source-watch.ts) | [src/scanner.ts](../src/scanner.ts) | Invokes supplied onObservations callback | typescript |
| [src/scanner/source-watch.ts](../src/scanner/source-watch.ts) | [src/scanner/session.ts](../src/scanner/session.ts) | Invokes supplied onError callback; Invokes supplied onObservations callback | typescript |
| [src/viewers/tui/panes/screen.ts](../src/viewers/tui/panes/screen.ts) | [src/viewers/tui/terminal-viewer.ts](../src/viewers/tui/terminal-viewer.ts) | Invokes supplied onHierarchyRow callback; Invokes supplied onMapCell callback | typescript |
| [src/viewers/web/atoms/settings-dialog.ts](../src/viewers/web/atoms/settings-dialog.ts) | [src/viewers/web/review/control.ts](../src/viewers/web/review/control.ts) | Invokes supplied onClose callback | typescript |
| [src/viewers/web/authoring.ts](../src/viewers/web/authoring.ts) | [src/viewers/web/render.ts](../src/viewers/web/render.ts) | Invokes supplied live callback; Invokes supplied world callback | typescript |
| [src/viewers/web/iso/pointer.ts](../src/viewers/web/iso/pointer.ts) | [src/viewers/web/render.ts](../src/viewers/web/render.ts) | Invokes supplied editProject callback; Invokes supplied orbiting callback; Invokes supplied select callback | typescript |
| [src/viewers/web/review/control.ts](../src/viewers/web/review/control.ts) | [src/viewers/web/render.ts](../src/viewers/web/render.ts) | Invokes supplied world callback | typescript |
| [src/viewers/web/search/session.ts](../src/viewers/web/search/session.ts) | [src/viewers/web/render.ts](../src/viewers/web/render.ts) | Invokes supplied anchorOf callback; Invokes supplied apply callback; Invokes supplied openTask callback; Invokes supplied previewMap callback; Invokes supplied snapshot callback; Invokes supplied taskElements callback | typescript |
| [src/viewers/web/source/control.ts](../src/viewers/web/source/control.ts) | [src/viewers/web/render.ts](../src/viewers/web/render.ts) | Invokes supplied element callback; Invokes supplied repaint callback; Invokes supplied revision callback | typescript |
| [src/viewers/web/task-diff/control.ts](../src/viewers/web/task-diff/control.ts) | [src/viewers/web/render.ts](../src/viewers/web/render.ts) | Invokes supplied repaint callback; Invokes supplied world callback | typescript |
