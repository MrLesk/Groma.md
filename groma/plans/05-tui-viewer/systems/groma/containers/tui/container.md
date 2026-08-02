---
id: tui
kind: container
parent: groma
---

# TUI

Presents the same fixed C4 world as the viewer inside any terminal, navigated
entirely from the keyboard across the four pre-configured levels, drawn in the
terminal's own theme colors.

## Technology

Bun and OpenTUI.

## Relationships

| Target | Description | Technology |
| --- | --- | --- |
| [Architecture workspace](../architecture-workspace/container.md) | Reads observed components and plan revisions | Local filesystem |
| [Viewer](../viewer/container.md) | Shares the projected world model | In-process modules |
