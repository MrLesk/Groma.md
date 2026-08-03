---
id: source-watcher
kind: component
parent: scanner
---

# Source watcher

Watches supported source files and requests a fresh bounded scan when they
change.

## Relationships

| Target | Description | Technology |
| --- | --- | --- |
| [Source project](../../../../source-project/system.md) | Watches supported source files | Filesystem events |
| [Scanner plugin](scanner-plugin.md) | Requests a fresh scan | In-process event |
