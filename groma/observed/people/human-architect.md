---
id: human-architect
kind: person
---

# Human architect

Understands, plans, and reviews the architecture of a software system. They open a viewer to judge whether a scan is recognizable, change the architecture through Groma rather than by hand, and accept a ghost once a scan has matched it.

## Relationships

| Target | Description | Technology |
| --- | --- | --- |
| [CLI](../systems/groma/containers/cli/container.md) | Starts the viewers | Command line |
| [Terminal viewer](../systems/groma/containers/terminal-viewer/container.md) | Reads the architecture | groma view |
| [Web viewer](../systems/groma/containers/web-viewer/container.md) | Reads the architecture | groma web |
