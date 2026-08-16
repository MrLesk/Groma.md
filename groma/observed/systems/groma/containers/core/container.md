---
id: core
kind: container
parent: groma
---

# Core

Owns architecture identity and merges observed architecture and planned fragments into one world.

## Relationships

| Target | Description | Technology |
| --- | --- | --- |
| [Architecture workspace](../architecture-workspace/container.md) | Reads and writes architecture Markdown | Filesystem |
| [Terminal viewer](../terminal-viewer/container.md) | Supplies the annotated world | In-process data |
| [Web viewer](../web-viewer/container.md) | Supplies the annotated world | In-process data |
