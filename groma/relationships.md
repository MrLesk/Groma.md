---
type: Groma Relationships
title: Architecture relationships
---

## Relationships

| Source | Target | Description | Technology |
| --- | --- | --- | --- |
| [Coding agent](actors/coding-agent.md) | [Commands](systems/groma/containers/cli/components/commands.md) | Runs Groma while implementing | Command line |
| [Coding agent](actors/coding-agent.md) | [Screen](systems/groma/containers/terminal-viewer/components/screen.md) | Reads the architecture in the terminal | groma view |
| [Coding agent](actors/coding-agent.md) | [Page](systems/groma/containers/web-viewer/components/page.md) | Reads the architecture in the browser | groma web |
| [Human architect](actors/human-architect.md) | [Commands](systems/groma/containers/cli/components/commands.md) | Starts and authors through Groma | Command line |
| [Human architect](actors/human-architect.md) | [Screen](systems/groma/containers/terminal-viewer/components/screen.md) | Reviews the architecture in the terminal | groma view |
| [Human architect](actors/human-architect.md) | [Page](systems/groma/containers/web-viewer/components/page.md) | Reviews the architecture in the browser | groma web |
| [src/cli.ts](../src/cli.ts) | [src/init-command.ts](../src/init-command.ts) | Runs the interactive setup or non-interactive initialization flow | groma init |
| [src/cli.ts](../src/cli.ts) | [src/scanner.ts](../src/scanner.ts) | Runs a complete scan | groma scan |
| [src/cli.ts](../src/cli.ts) | [src/viewers/web/export.ts](../src/viewers/web/export.ts) | Publishes the current Web view as static files | CLI |
| [src/cli.ts](../src/cli.ts) | [src/curate.ts](../src/curate.ts) | Curates scan evidence and collaborations | groma edit and groma add relation |
| [src/draft.ts](../src/draft.ts) | [src/architecture-reader.ts](../src/architecture-reader.ts) | Checks the current world before writing | In-process data |
| [src/draft.ts](../src/draft.ts) | [src/markdown-emitter.ts](../src/markdown-emitter.ts) | Writes the ghost document | In-process data |
| [src/edit.ts](../src/edit.ts) | [src/architecture-reader.ts](../src/architecture-reader.ts) | Finds the current owner of authored meaning | In-process data |
| [src/edit.ts](../src/edit.ts) | [src/markdown-emitter.ts](../src/markdown-emitter.ts) | Rewrites only the requested authored meaning | In-process data |
| [src/edit.ts](../src/edit.ts) | [src/curate.ts](../src/curate.ts) | Delegates structural edits of scanned evidence | In-process data |
| [src/init-command.ts](../src/init-command.ts) | [src/initialize.ts](../src/initialize.ts) | Loads and saves the project identity, storage root, minimum package, and managed agent instructions | Initialization |
| [src/init-command.ts](../src/init-command.ts) | [src/scanner.ts](../src/scanner.ts) | Runs the accepted first scan and reports what it found | Scanner |
| [src/init-command.ts](../src/init-command.ts) | [src/cli.ts](../src/cli.ts) | Opens the selected viewer without scanning the repository a second time | CLI |
| [src/group.ts](../src/group.ts) | [src/architecture-model.ts](../src/architecture-model.ts) | Validates the observed structure before mutation | In-process data |
| [src/curate.ts](../src/curate.ts) | [src/markdown-emitter.ts](../src/markdown-emitter.ts) | Writes validated structural changes | In-process data |
| [src/plain-world.ts](../src/plain-world.ts) | [src/core.ts](../src/core.ts) | Loads the merged architecture | In-process data |
| [src/initialize.ts](../src/initialize.ts) | [src/groma-filesystem.ts](../src/groma-filesystem.ts) | Selects the repository's architecture root and writes the minimum package | Filesystem access |
| [src/initialize.ts](../src/initialize.ts) | [src/project-profile.ts](../src/project-profile.ts) | Renders the project identity profile | Project profile |
| [src/initialize.ts](../src/initialize.ts) | [src/agent-instructions.ts](../src/agent-instructions.ts) | Reconciles the managed repository instruction block | Initialization |
| [src/welcome/model.ts](../src/welcome/model.ts) | [plugins/work-sources/backlog/src/index.ts](../plugins/work-sources/backlog/src/index.ts) | Reads embedded work-source readiness and install guidance | In-process data |
| [src/welcome/model.ts](../src/welcome/model.ts) | [src/scanner/modules/inventory.ts](../src/scanner/modules/inventory.ts) | Reads configured readiness without executing scanner code | In-process data |
| [src/accept.ts](../src/accept.ts) | [src/markdown-emitter.ts](../src/markdown-emitter.ts) | Writes the accepted document | In-process data |
| [src/accept.ts](../src/accept.ts) | [src/scan-reconciler.ts](../src/scan-reconciler.ts) | Uses complete scan evidence for matching | In-process data |
| [src/accept.ts](../src/accept.ts) | [src/architecture-reader.ts](../src/architecture-reader.ts) | Finds the ghost by id | In-process data |
| [src/architecture-reader.ts](../src/architecture-reader.ts) | [src/groma-filesystem.ts](../src/groma-filesystem.ts) | Reads the selected architecture tree | Filesystem access |
| [Architecture writer](systems/groma/containers/core/components/architecture-writer.md) | [Git](externals/git.md) | Writes architecture for versioning | Markdown |
| [src/markdown-emitter.ts](../src/markdown-emitter.ts) | [src/groma-filesystem.ts](../src/groma-filesystem.ts) | Writes through the selected architecture tree | Filesystem access |
| [src/project-profile.ts](../src/project-profile.ts) | [src/groma-filesystem.ts](../src/groma-filesystem.ts) | Reads and saves the project profile | Filesystem access |
| [src/sheet/scene.ts](../src/sheet/scene.ts) | [src/sheet/route.ts](../src/sheet/route.ts) | Routes every authored collaboration | In-process data |
| [src/core.ts](../src/core.ts) | [src/architecture-model.ts](../src/architecture-model.ts) | Builds one semantic graph | In-process data |
| [src/core.ts](../src/core.ts) | [src/architecture-reader.ts](../src/architecture-reader.ts) | Reads every architecture revision | In-process data |
| [plugins/scanners/csharp/src/adapter.ts](../plugins/scanners/csharp/src/adapter.ts) | [packages/scanner/src/index.ts](../packages/scanner/src/index.ts) | Publishes one complete observation | JSON |
| [src/scanner/registry.ts](../src/scanner/registry.ts) | [plugins/scanners/typescript/src/index.ts](../plugins/scanners/typescript/src/index.ts) | Collects TypeScript evidence | Scan observation |
| [src/scanner/registry.ts](../src/scanner/registry.ts) | [plugins/scanners/csharp/src/index.ts](../plugins/scanners/csharp/src/index.ts) | Collects C# evidence | Scan observation |
| [src/scanner/registry.ts](../src/scanner/registry.ts) | [src/scanner/modules/inventory.ts](../src/scanner/modules/inventory.ts) | Loads only configured and present module entries | ECMAScript module |
| [src/scanner/registry.ts](../src/scanner/registry.ts) | [packages/scanner/src/index.ts](../packages/scanner/src/index.ts) | Validates complete language evidence | In-process data |
| [src/scan-reconciler.ts](../src/scan-reconciler.ts) | [src/architecture-reader.ts](../src/architecture-reader.ts) | Matches evidence against stable ownership | In-process data |
| [src/scan-reconciler.ts](../src/scan-reconciler.ts) | [src/markdown-emitter.ts](../src/markdown-emitter.ts) | Folds the complete batch into Markdown | In-process data |
| [src/scanner/modules/inventory.ts](../src/scanner/modules/inventory.ts) | [src/scanner/registry.ts](../src/scanner/registry.ts) | Supplies enabled and verified module entries | ECMAScript module path |
| [plugins/scanners/typescript/src/scan.ts](../plugins/scanners/typescript/src/scan.ts) | [packages/scanner/src/index.ts](../packages/scanner/src/index.ts) | Publishes one complete observation | In-process data |
| [TypeScript scanner](systems/groma/containers/scanner/components/typescript-scanner.md) | [Git](externals/git.md) | Lists tracked and unignored source files | git ls-files |
| [src/viewers/tui/panes/details.ts](../src/viewers/tui/panes/details.ts) | [src/viewers/source/structure.ts](../src/viewers/source/structure.ts) | Reads selected structure, source, and task file diffs | TypeScript |
| [src/viewers/tui/navigation-history.ts](../src/viewers/tui/navigation-history.ts) | [src/history/revisions.ts](../src/history/revisions.ts) | Selects compatible Groma revisions | TypeScript |
| [src/viewers/tui/navigation.ts](../src/viewers/tui/navigation.ts) | [src/viewers/tui/navigation-history.ts](../src/viewers/tui/navigation-history.ts) | Delegates revision-list state | TypeScript |
| [src/viewers/tui/projection-container.ts](../src/viewers/tui/projection-container.ts) | [src/sheet/types.ts](../src/sheet/types.ts) | Uses the fixed shared surfaces and routes | In-process data |
| [src/viewers/tui/terminal-viewer.ts](../src/viewers/tui/terminal-viewer.ts) | [src/viewers/tui/navigation.ts](../src/viewers/tui/navigation.ts) | Reduces terminal input over viewer state | In-process data |
| [src/viewers/tui/panes/view.ts](../src/viewers/tui/panes/view.ts) | [src/viewers/tui/projection.ts](../src/viewers/tui/projection.ts) | Projects the map pane | OpenTUI |
| [src/viewers/tui/panes/view.ts](../src/viewers/tui/panes/view.ts) | [src/viewers/tui/work/model.ts](../src/viewers/tui/work/model.ts) | Shows tasks and their architecture touch points | WorkSnapshot |
| [src/viewers/tui/work/model.ts](../src/viewers/tui/work/model.ts) | [plugins/work-sources/backlog/src/index.ts](../plugins/work-sources/backlog/src/index.ts) | Reads workflow and complete task information | WorkSnapshot |
| [src/viewers/tui/work/navigation.ts](../src/viewers/tui/work/navigation.ts) | [src/viewers/tui/navigation.ts](../src/viewers/tui/navigation.ts) | Temporarily owns task focus inside viewer state | In-process data |
| [src/viewers/tui/work/model.ts](../src/viewers/tui/work/model.ts) | [src/viewers/tui/projection.ts](../src/viewers/tui/projection.ts) | Frames every selected task anchor | In-process data |
| [plugins/work-sources/backlog/src/index.ts](../plugins/work-sources/backlog/src/index.ts) | [packages/work-source/src/index.ts](../packages/work-source/src/index.ts) | Implements work reads, detail reads, readiness and watch lifecycle | @groma/work-source |
| [Backlog plugin](systems/groma/containers/view-host/components/backlog-plugin.md) | [Backlog.md](externals/backlog-md.md) | Reads task summaries, selected task details, and workflow settings without writing tasks | Backlog CLI: task list --json, task view  --json, config get |
| [src/view-host.ts](../src/view-host.ts) | [src/architecture-watch.ts](../src/architecture-watch.ts) | Reloads the world when Markdown changes | watchArchitecture |
| [src/view-host.ts](../src/view-host.ts) | [plugins/work-sources/backlog/src/index.ts](../plugins/work-sources/backlog/src/index.ts) | Reads workflow and task snapshots | WorkSnapshot |
| [src/view-host.ts](../src/view-host.ts) | [src/scanner.ts](../src/scanner.ts) | Folds watched source changes | watchScan |
| [src/view-host.ts](../src/view-host.ts) | [src/viewers/tui/terminal-viewer.ts](../src/viewers/tui/terminal-viewer.ts) | Publishes the composed terminal view | OpenTUI |
| [src/view-host.ts](../src/view-host.ts) | [src/core.ts](../src/core.ts) | Loads the semantic architecture graph | In-process data |
| [src/view-host.ts](../src/view-host.ts) | [src/history/revisions.ts](../src/history/revisions.ts) | Loads current and historical terminal models | TypeScript |
| [src/viewers/web/work/component-tasks.ts](../src/viewers/web/work/component-tasks.ts) | [src/work/pins.ts](../src/work/pins.ts) | Uses the shared component-to-task grouping | In-process data |
| [src/viewers/web/export.ts](../src/viewers/web/export.ts) | [src/viewers/web/page.ts](../src/viewers/web/page.ts) | Writes the read-only HTML shell with its embedded snapshot | HTML |
| [src/viewers/web/export.ts](../src/viewers/web/export.ts) | [src/viewers/web/runtime.ts](../src/viewers/web/runtime.ts) | Reuses current map composition and browser bundling | In-process data |
| [src/viewers/web/export.ts](../src/viewers/web/export.ts) | [plugins/work-sources/backlog/src/index.ts](../plugins/work-sources/backlog/src/index.ts) | Materializes and watches Backlog work | WorkSource |
| [src/viewers/web/export.ts](../src/viewers/web/export.ts) | [src/work/pins.ts](../src/work/pins.ts) | Maps published tasks to architecture anchors | In-process data |
| [src/viewers/web/export.ts](../src/viewers/web/export.ts) | [src/viewers/web/source/control.ts](../src/viewers/web/source/control.ts) | Materializes architecture-owned source and code structure | In-process data |
| [src/viewers/web/export.ts](../src/viewers/web/export.ts) | [src/viewers/web/task-diff/control.ts](../src/viewers/web/task-diff/control.ts) | Materializes task diffs and their live error outcomes | In-process data |
| [src/viewers/web/export.ts](../src/viewers/web/export.ts) | [src/architecture-watch.ts](../src/architecture-watch.ts) | Republishes after architecture Markdown changes | watchArchitecture |
| [src/viewers/web/export.ts](../src/viewers/web/export.ts) | [src/scanner.ts](../src/scanner.ts) | Republishes after supported source changes | watchScan |
| [src/viewers/web/flow/state.ts](../src/viewers/web/flow/state.ts) | [src/viewers/flows.ts](../src/viewers/flows.ts) | Reads explicit flow membership and ordered relationship steps | In-process data |
| [src/viewers/web/page.ts](../src/viewers/web/page.ts) | [src/viewers/web/render.ts](../src/viewers/web/render.ts) | Loads the browser runtime | Browser module |
| [src/viewers/web/project/editor.ts](../src/viewers/web/project/editor.ts) | [src/viewers/web/map-session.ts](../src/viewers/web/map-session.ts) | Saves a valid project profile | HTTP |
| [src/viewers/web/render.ts](../src/viewers/web/render.ts) | [src/viewers/web/iso/camera.ts](../src/viewers/web/iso/camera.ts) | Fits, pans, and zooms the map | In-process data |
| [src/viewers/web/render.ts](../src/viewers/web/render.ts) | [src/viewers/web/iso/map.ts](../src/viewers/web/iso/map.ts) | Paints and restyles the SVG blueprint | DOM |
| [src/viewers/web/render.ts](../src/viewers/web/render.ts) | [src/viewers/web/iso/project.ts](../src/viewers/web/iso/project.ts) | Projects the sheet into screen polygons | In-process data |
| [src/viewers/web/render.ts](../src/viewers/web/render.ts) | [src/viewers/web/project/editor.ts](../src/viewers/web/project/editor.ts) | Edits the project profile. | HTTP |
| [src/viewers/web/render.ts](../src/viewers/web/render.ts) | [src/viewers/web/source/control.ts](../src/viewers/web/source/control.ts) | Opens owned Code without changing architecture selection | Browser state |
| [src/viewers/web/revision/control.ts](../src/viewers/web/revision/control.ts) | [src/history/revisions.ts](../src/history/revisions.ts) | Reads and opens Groma revisions | TypeScript |
| [src/viewers/web/source/control.ts](../src/viewers/web/source/control.ts) | [src/viewers/web/map-session.ts](../src/viewers/web/map-session.ts) | Requests only selected Code from the active revision | HTTP |
| [src/viewers/web/source/view.ts](../src/viewers/web/source/view.ts) | [src/viewers/web/organisms/details.ts](../src/viewers/web/organisms/details.ts) | Reuses the selected component inspector | DOM |
| [src/viewers/web/source/control.ts](../src/viewers/web/source/control.ts) | [src/viewers/source/read.ts](../src/viewers/source/read.ts) | Reads selected component structure and source | TypeScript |
| [src/viewers/web/task-diff/control.ts](../src/viewers/web/task-diff/control.ts) | [src/viewers/web/revision/control.ts](../src/viewers/web/revision/control.ts) | Reads exact task commits and file versions | Git |
| [src/viewers/web/task-diff/view.ts](../src/viewers/web/task-diff/view.ts) | [src/viewers/web/source/highlight.ts](../src/viewers/web/source/highlight.ts) | Reuses source highlighting and drill-down | DOM and CSS |
| [src/viewers/web/task-diff/control.ts](../src/viewers/web/task-diff/control.ts) | [src/viewers/web/map-session.ts](../src/viewers/web/map-session.ts) | Loads task diffs only after selection | JSON |
| [src/viewers/web/task-diff/control.ts](../src/viewers/web/task-diff/control.ts) | [src/viewers/source/diff.ts](../src/viewers/source/diff.ts) | Reads the selected task file diff | TypeScript |
| [src/viewers/web/map-session.ts](../src/viewers/web/map-session.ts) | [src/architecture-watch.ts](../src/architecture-watch.ts) | Reloads the world when Markdown changes | watchArchitecture |
| [src/viewers/web/map-session.ts](../src/viewers/web/map-session.ts) | [plugins/work-sources/backlog/src/index.ts](../plugins/work-sources/backlog/src/index.ts) | Loads optional work snapshots independently | WorkSource |
| [src/viewers/web/map-session.ts](../src/viewers/web/map-session.ts) | [src/viewers/web/page.ts](../src/viewers/web/page.ts) | Serves the browser shell and embedded state | HTML |
| [src/viewers/web/server.ts](../src/viewers/web/server.ts) | [src/project-profile.ts](../src/project-profile.ts) | Loads and saves the project profile | ProjectProfile |
| [src/viewers/web/map-session.ts](../src/viewers/web/map-session.ts) | [src/scanner.ts](../src/scanner.ts) | Folds watched source changes | watchScan |
| [src/viewers/web/runtime.ts](../src/viewers/web/runtime.ts) | [src/sheet/scene.ts](../src/sheet/scene.ts) | Composes the shared map sheet once per generation | In-process data |
| [src/viewers/web/runtime.ts](../src/viewers/web/runtime.ts) | [src/core.ts](../src/core.ts) | Loads the semantic architecture graph | In-process data |
| [src/viewers/web/map-session.ts](../src/viewers/web/map-session.ts) | [src/work/pins.ts](../src/work/pins.ts) | Maps tasks to architecture anchors | In-process data |
| [src/viewers/web/organisms/details.ts](../src/viewers/web/organisms/details.ts) | [src/viewers/web/work/component-tasks.ts](../src/viewers/web/work/component-tasks.ts) | Delegates linked component task rows to the Work painter | DOM |
| [src/viewers/web/work/pins.ts](../src/viewers/web/work/pins.ts) | [src/work/pins.ts](../src/work/pins.ts) | Uses the shared task anchors | In-process data |

## Derived relationships

| Source | Target | Description | Technology |
| --- | --- | --- | --- |
| [src/architecture-watch.ts](../src/architecture-watch.ts) | [src/view-host.ts](../src/view-host.ts) | Invokes supplied onChange callback | typescript |
| [src/architecture-watch.ts](../src/architecture-watch.ts) | [src/viewers/web/export.ts](../src/viewers/web/export.ts) | Invokes supplied onChange callback | typescript |
| [src/architecture-watch.ts](../src/architecture-watch.ts) | [src/viewers/web/map-session.ts](../src/viewers/web/map-session.ts) | Invokes supplied onChange callback | typescript |
| [src/init-command.ts](../src/init-command.ts) | [src/cli.ts](../src/cli.ts) | Invokes supplied openViewer callback | typescript |
| [src/scanner.ts](../src/scanner.ts) | [src/cli.ts](../src/cli.ts) | Invokes supplied onError callback; Invokes supplied onFold callback | typescript |
| [src/scanner.ts](../src/scanner.ts) | [src/view-host.ts](../src/view-host.ts) | Invokes supplied onFold callback | typescript |
| [src/scanner.ts](../src/scanner.ts) | [src/viewers/web/export.ts](../src/viewers/web/export.ts) | Invokes supplied onFold callback | typescript |
| [src/scanner.ts](../src/scanner.ts) | [src/viewers/web/map-session.ts](../src/viewers/web/map-session.ts) | Invokes supplied onFold callback | typescript |
| [src/viewers/tui/panes/screen.ts](../src/viewers/tui/panes/screen.ts) | [src/viewers/tui/terminal-viewer.ts](../src/viewers/tui/terminal-viewer.ts) | Invokes supplied onHierarchyRow callback; Invokes supplied onMapCell callback | typescript |
| [src/viewers/tui/terminal-viewer.ts](../src/viewers/tui/terminal-viewer.ts) | [src/view-host.ts](../src/view-host.ts) | Invokes supplied onRefresh callback; Invokes supplied readSource callback; Invokes supplied readStructure callback; Invokes supplied readTask callback; Invokes supplied readTaskDiff callback | typescript |
| [src/viewers/web/authoring.ts](../src/viewers/web/authoring.ts) | [src/viewers/web/render.ts](../src/viewers/web/render.ts) | Invokes supplied live callback; Invokes supplied world callback | typescript |
| [src/viewers/web/iso/pointer.ts](../src/viewers/web/iso/pointer.ts) | [src/viewers/web/render.ts](../src/viewers/web/render.ts) | Invokes supplied editProject callback; Invokes supplied orbiting callback | typescript |
| [src/viewers/web/search/session.ts](../src/viewers/web/search/session.ts) | [src/viewers/web/render.ts](../src/viewers/web/render.ts) | Invokes supplied anchorOf callback; Invokes supplied apply callback; Invokes supplied openTask callback; Invokes supplied previewMap callback; Invokes supplied snapshot callback; Invokes supplied taskElements callback | typescript |
| [src/viewers/web/source/control.ts](../src/viewers/web/source/control.ts) | [src/viewers/web/render.ts](../src/viewers/web/render.ts) | Invokes supplied element callback; Invokes supplied repaint callback; Invokes supplied revision callback | typescript |
| [src/viewers/web/task-diff/control.ts](../src/viewers/web/task-diff/control.ts) | [src/viewers/web/render.ts](../src/viewers/web/render.ts) | Invokes supplied repaint callback; Invokes supplied world callback | typescript |
