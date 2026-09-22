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
| [Developer](actors/developer.md) | [Command interface](systems/groma-md/containers/cli/components/src-cli.md) | Runs project scans, architecture commands, and scanner setup | Groma CLI |
| [Developer](actors/developer.md) | [Task changes panel](systems/groma-md/containers/export/components/task-diff-control.md) | Reviews a selected task and its source changes in the browser map | Browser UI |
| [Developer](actors/developer.md) | [Revision selector](systems/groma-md/containers/export/components/revision-control.md) | Selects a stored architecture revision in the browser map | Browser UI |
| [plugins/work-sources/backlog/src/index.ts](../plugins/work-sources/backlog/src/index.ts) | [Backlog.md](externals/backlog-md.md) | Reads task summaries, selected details, workflow settings, and live updates | Backlog CLI and JSON |
| [src/history/revisions.ts](../src/history/revisions.ts) | [Git](externals/git.md) | Lists architecture commits and reads files or snapshots at selected revisions | Git CLI |
| [src/scanner/modules/published.ts](../src/scanner/modules/published.ts) | [Scanner package registry](externals/scanner-package-registry.md) | Reads published scanner releases and compatibility metadata | HTTP registry API |
| [src/scanner/modules/package.ts](../src/scanner/modules/package.ts) | [Scanner package registry](externals/scanner-package-registry.md) | Downloads the selected scanner package and its dependencies | Bun install and npm registry protocol |
| [src/cli.ts](../src/cli.ts) | [src/authoring.ts](../src/authoring.ts) | Dispatches explicit architecture creation, editing, drafting, acceptance, and removal | Function call |
| [src/edit.ts](../src/edit.ts) | [src/markdown-emitter.ts](../src/markdown-emitter.ts) | Writes the validated change to an architecture record | Function call |
| [src/scanner/cli.ts](../src/scanner/cli.ts) | [src/scanner/modules/inventory.ts](../src/scanner/modules/inventory.ts) | Installs or updates the requested scanner and records its selected source | Function call |
| [src/viewers/web/task-diff/control.ts](../src/viewers/web/task-diff/control.ts) | [src/viewers/web/data.ts](../src/viewers/web/data.ts) | Requests selected task details and file differences through the supplied data operations | Bound function calls |
| [src/viewers/web/revision/control.ts](../src/viewers/web/revision/control.ts) | [src/viewers/web/data.ts](../src/viewers/web/data.ts) | Requests available revisions and the selected architecture snapshot | Function call |
| [src/viewers/web/map-session.ts](../src/viewers/web/map-session.ts) | [src/history/revisions.ts](../src/history/revisions.ts) | Lists architecture revisions and loads the requested Git snapshot | Function call |
| [Coding agent](actors/coding-agent.md) | [Command interface](systems/groma-md/containers/cli/components/src-cli.md) | Reads architecture, runs scans, and submits explicit architecture changes | Groma CLI |
| [src/cli.ts](../src/cli.ts) | [src/lint-command.ts](../src/lint-command.ts) | Registers the lint command on the shared CLI program | Function call |
| [src/viewers/web/page.ts](../src/viewers/web/page.ts) | [src/viewers/web/sharing/metadata.ts](../src/viewers/web/sharing/metadata.ts) | Embeds Open Graph metadata so a shared page shows the architecture cover | Function call |
| [src/viewers/web/export.ts](../src/viewers/web/export.ts) | [src/viewers/web/sharing/images.ts](../src/viewers/web/sharing/images.ts) | Writes theme-specific cover PNGs next to the static map | Function call |
| [src/viewers/web/map-session.ts](../src/viewers/web/map-session.ts) | [src/viewers/web/sharing/images.ts](../src/viewers/web/sharing/images.ts) | Generates live cover images for the current architecture | Function call |
| [src/viewers/web/server.ts](../src/viewers/web/server.ts) | [src/viewers/web/startup/progress.ts](../src/viewers/web/startup/progress.ts) | Reports named startup phases to the open browser page | Function call |

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
| [src/viewers/web/iso/pointer.ts](../src/viewers/web/iso/pointer.ts) | [src/viewers/web/render.ts](../src/viewers/web/render.ts) | Invokes supplied callbacks: editProject, orbit, orbiting, pan, select, zoom | typescript |
| [src/viewers/web/review/control.ts](../src/viewers/web/review/control.ts) | [src/viewers/web/render.ts](../src/viewers/web/render.ts) | Invokes supplied callback: world | typescript |
| [src/viewers/web/search/session.ts](../src/viewers/web/search/session.ts) | [src/viewers/web/render.ts](../src/viewers/web/render.ts) | Invokes supplied callbacks: anchorOf, apply, openTask, previewMap, snapshot, taskElements | typescript |
| [src/viewers/web/source/control.ts](../src/viewers/web/source/control.ts) | [src/viewers/web/render.ts](../src/viewers/web/render.ts) | Invokes supplied callbacks: comparison, element, from, repaint, revision | typescript |
| [src/viewers/web/task-diff/control.ts](../src/viewers/web/task-diff/control.ts) | [src/viewers/web/render.ts](../src/viewers/web/render.ts) | Invokes supplied callbacks: repaint, world | typescript |
