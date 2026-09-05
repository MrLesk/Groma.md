---
type: Groma Flow
title: 'Agent: static export'
groma:
  id: agent-static-export
---

Export the current architecture as a read-only website. The export loads the semantic world and fixed sheet, includes owned source and task information, and writes a browser snapshot that can be hosted as static files.

## Steps

| From | To | Action |
| --- | --- | --- |
| [Coding agent][coding-agent] | [Commands][commands] | Start static export |
| [Commands][commands] | [Export][export] | Start a static architecture export |
| [Export][export] | [Web server][web-server] | Reuse the map loader and browser bundle |
| [Web server][web-server] | [World loader][world-loader] | Load the current semantic architecture |
| [World loader][world-loader] | [Architecture reader][architecture-reader] | Read the architecture records, including flows |
| [World loader][world-loader] | [Architecture model][architecture-model] | Resolve the architecture and authored flow steps |
| [Web server][web-server] | [Sheet composition][sheet-composition] | Compose the fixed architecture sheet |
| [Sheet composition][sheet-composition] | [Sheet routing][sheet-routing] | Route the existing collaborations |
| [Export][export] | [Backlog plugin][backlog-plugin] | Read the available work snapshot |
| [Export][export] | [Work projection][work-projection] | Map exported work to architecture anchors |
| [Export][export] | [Source viewer][source-viewer] | Include architecture-owned source for inspection |
| [Export][export] | [Task diff][task-diff] | Include the available task file differences |
| [Export][export] | [Page][page] | Write the read-only page with its complete snapshot |

[coding-agent]: ../actors/coding-agent.md
[commands]: ../systems/groma/containers/cli/components/commands.md
[export]: ../systems/groma/containers/web-viewer/components/export.md
[web-server]: ../systems/groma/containers/web-viewer/components/web-server.md
[world-loader]: ../systems/groma/containers/core/components/world-loader.md
[architecture-reader]: ../systems/groma/containers/core/components/architecture-reader.md
[architecture-model]: ../systems/groma/containers/core/components/architecture-model.md
[sheet-composition]: ../systems/groma/containers/core/components/sheet-composition.md
[sheet-routing]: ../systems/groma/containers/core/components/sheet-routing.md
[backlog-plugin]: ../systems/groma/containers/view-host/components/backlog-plugin.md
[work-projection]: ../systems/groma/containers/view-host/components/work-projection.md
[source-viewer]: ../systems/groma/containers/web-viewer/components/source-viewer.md
[task-diff]: ../systems/groma/containers/web-viewer/components/task-diff.md
[page]: ../systems/groma/containers/web-viewer/components/page.md
