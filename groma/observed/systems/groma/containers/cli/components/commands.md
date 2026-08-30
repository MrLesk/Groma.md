---
id: commands
kind: component
parent: cli
group: Commands
code:
  - scanner: typescript
    file: src/cli.ts
    dependencies: 9
    dependents: 0
---

# Commands

Routes named groma commands and the action returned by the bare-terminal launcher through the same owning operations. Web and interactive view scan before opening; plain or targeted view reads the existing world. The command layer does not decide what the architecture means.

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
