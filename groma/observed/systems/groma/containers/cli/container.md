---
id: cli
kind: container
parent: groma
code:
  - scanner: typescript
    file: src/cli.ts
---

# Cli

Starts Groma from the command line: `groma view`, `groma web`, and `groma scan`.

## Relationships

| Target | Description | Technology |
| --- | --- | --- |
| [Terminal viewer](../terminal-viewer/container.md) | Starts the terminal map | groma view |
| [Web viewer](../web-viewer/container.md) | Starts the browser map | groma web |
| [Scanner](../scanner/container.md) | Runs a scan | groma scan |
