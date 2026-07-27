---
id: markdown-watcher
kind: component
parent: viewer
---

# Markdown watcher

Watches the Groma directory and asks the viewer to reload when architecture files
change.

## Relationships

| Target | Description | Technology |
| --- | --- | --- |
| [Architecture workspace](../../architecture-workspace/container.md) | Watches Markdown changes | Filesystem events |
| [Architecture model](architecture-model.md) | Requests a model reload | In-process event |
