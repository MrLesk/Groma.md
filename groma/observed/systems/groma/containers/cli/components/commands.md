---
id: commands
kind: component
parent: cli
code:
  - scanner: typescript
    file: src/cli.ts
---

# Commands

The `groma` command line: `view`, `web`, `scan`, `create`, `edit`, `accept`, and the bare `groma` that prints instructions. Each command hands straight over to the code that owns it; nothing here decides what the architecture means.

## Relationships

| Target | Description | Technology |
| --- | --- | --- |
| [Terminal host](../../view-host/components/terminal-host.md) | Starts the terminal map | groma view |
| [Web server](../../web-viewer/components/web-server.md) | Starts the browser map | groma web |
| [Plain text view](plain-world.md) | Prints the world as text | groma view --plain |
| [Scan](../../scanner/components/scan.md) | Runs a scan | groma scan |
| [Create](create.md) | Authors a plan ghost | groma create |
| [Edit](edit.md) | Records a required change | groma edit |
| [Accept](../../core/components/accept.md) | Accepts a matched ghost | groma accept |
| [Instructions](instructions.md) | Prints what to run next | groma instructions |
