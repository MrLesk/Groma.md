---
type: Groma Flow
title: 'Agent: browser review'
groma:
  id: agent-browser-review
---

Read the architecture in the browser. The page loads the renderer, which projects the shared sheet, paints its elements and routes, and positions the camera for inspection.

## Steps

| From | To | Action |
| --- | --- | --- |
| [Coding agent][coding-agent] | [Page][page] | Start browser review |
| [Page][page] | [Render][render] | Load the browser renderer with the architecture snapshot |
| [Render][render] | [Iso projection][iso-projection] | Project the fixed sheet into the browser view |
| [Render][render] | [Iso map][iso-map] | Paint the architecture and its authored routes |
| [Render][render] | [Iso camera][iso-camera] | Frame and navigate the map |

[coding-agent]: ../actors/coding-agent.md
[page]: ../systems/groma/containers/web-viewer/components/page.md
[render]: ../systems/groma/containers/web-viewer/components/render.md
[iso-projection]: ../systems/groma/containers/web-viewer/components/iso-projection.md
[iso-map]: ../systems/groma/containers/web-viewer/components/iso-map.md
[iso-camera]: ../systems/groma/containers/web-viewer/components/iso-camera.md
