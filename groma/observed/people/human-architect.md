---
id: human-architect
kind: person
---

# Human architect

Understands, plans, and reviews the architecture of a software system. They open a viewer to judge whether a scan is recognizable, change the architecture through Groma rather than by hand, and accept a ghost once a scan has matched it.

## Relationships

| Target | Description | Technology |
| --- | --- | --- |
| [Commands](../systems/groma/containers/cli/components/commands.md) | Starts the viewers | Command line |
| [Screen](../systems/groma/containers/terminal-viewer/components/screen.md) | Reviews the architecture in the terminal | groma view |
| [Page](../systems/groma/containers/web-viewer/components/page.md) | Reviews the architecture in the browser | groma web |
