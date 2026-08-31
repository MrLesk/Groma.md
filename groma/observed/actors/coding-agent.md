---
type: C4 Actor
title: Coding agent
status: stable
groma:
  id: coding-agent
---

Plans and implements software changes while sharing the same architecture as human architects. It runs Groma from the command line, reads the world before changing code, and authors architecture through Groma.

## Relationships

| Target | Description | Technology |
| --- | --- | --- |
| [Commands](../systems/groma/containers/cli/components/commands.md) | Runs Groma while implementing | Command line |
| [Screen](../systems/groma/containers/terminal-viewer/components/screen.md) | Reads the architecture in the terminal | groma view |
| [Page](../systems/groma/containers/web-viewer/components/page.md) | Reads the architecture in the browser | groma web |
