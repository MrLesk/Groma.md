---
id: source-watcher
kind: component
parent: scanner
---

# Source watcher

Watches supported source files and requests a fresh bounded observation when they
change.

## Relationships

| Target | Description | Technology |
| --- | --- | --- |
| [Source project](../../../../source-project/system.md) | Watches supported source files | Filesystem events |
| [TypeScript observer](typescript-observer.md) | Requests a fresh observation | In-process event |
