---
id: world-layout
kind: component
parent: core
---

# World layout

Positions all components from their relationships, encloses them in containers and systems, places context peers, and
routes directed arrows with ELK. It returns the ELK layout as renderer-independent objects shared by every semantic
level. Camera framing and detail overlays project these objects but never change them.

## Relationships

| Target | Description | Technology |
| --- | --- | --- |
| [Terminal interface](../../terminal-viewer/components/terminal-interface.md) | Supplies fixed ELK objects with positions and routes | In-process data |
