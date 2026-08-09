---
id: core
kind: container
parent: groma
---

# Core

Owns the architecture model, reconciles scanner results, preserves curated Markdown, and supplies annotated view models.

## Relationships

| Target | Description | Technology |
| --- | --- | --- |
| [Architecture workspace](../architecture-workspace/container.md) | Reads and writes architecture Markdown | Local filesystem |
| [Terminal viewer](../terminal-viewer/container.md) | Supplies the annotated model and fixed-world ELK objects | In-process data |
