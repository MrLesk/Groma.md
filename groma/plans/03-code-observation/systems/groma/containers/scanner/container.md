---
id: scanner
kind: container
parent: groma
---

# Scanner

Observes a bounded source shape and writes observed architecture as component Markdown.

## Technology

Bun and TypeScript.

## Relationships

| Target | Description | Technology |
| --- | --- | --- |
| [Source project](../../../source-project/system.md) | Reads supported source files without executing them | Local filesystem |
| [Architecture workspace](../architecture-workspace/container.md) | Writes observed component documents | Markdown |
