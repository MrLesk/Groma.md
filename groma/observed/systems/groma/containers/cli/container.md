---
id: cli
kind: container
parent: groma
technology: commander, Bun
code:
  - scanner: typescript
    file: src/cli.ts
---

# CLI

The `groma` command. It starts the viewers, runs a scan, authors and edits plan ghosts, accepts a matched ghost, and prints the merged world as plain text when there is no terminal to draw in.

## Relationships

| Target | Description | Technology |
| --- | --- | --- |
| [View host](../view-host/container.md) | Starts the terminal map | groma view |
| [Web viewer](../web-viewer/container.md) | Starts the browser map | groma web |
| [Scanner](../scanner/container.md) | Runs a scan | groma scan |
| [Accept](../core/components/accept.md) | Accepts a matched ghost | groma accept |
