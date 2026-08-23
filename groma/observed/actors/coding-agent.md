---
id: coding-agent
kind: actor
---

# Coding agent

Plans and implements software changes while sharing the same architecture as human architects. It runs Groma from the command line to scan the repository, reads the world before it touches code, and authors plan ghosts for the parts it is about to build.

## Relationships

| Target | Description | Technology |
| --- | --- | --- |
| [Commands](../systems/groma/containers/cli/components/commands.md) | Runs Groma while implementing | Command line |
| [Screen](../systems/groma/containers/terminal-viewer/components/screen.md) | Reads the architecture in the terminal | groma view |
| [Page](../systems/groma/containers/web-viewer/components/page.md) | Reads the architecture in the browser | groma web |
