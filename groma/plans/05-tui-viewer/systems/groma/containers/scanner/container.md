---
id: scanner
kind: container
parent: groma
---

# Scanner

Scans a bounded source shape and writes observed architecture as component Markdown.

## Technology

Local scanner runtime and plugins.

## Relationships

| Target | Description | Technology |
| --- | --- | --- |
| [Source project](../../../source-project/system.md) | Reads supported source files without executing them | Local filesystem |
| [Architecture workspace](../architecture-workspace/container.md) | Writes observed component documents | Markdown |
