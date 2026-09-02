---
type: C4 Actor
title: Human architect
status: stable
groma:
  id: human-architect
---

Understands, drafts, and reviews the architecture of a software system. They judge whether scan evidence is recognizable, curate it through Groma, and accept drafted work once source evidence matches.

## Relationships

| Target | Description | Technology |
| --- | --- | --- |
| [Commands](../systems/groma/containers/cli/components/commands.md) | Starts and authors through Groma | Command line |
| [Screen](../systems/groma/containers/terminal-viewer/components/screen.md) | Reviews the architecture in the terminal | groma view |
| [Page](../systems/groma/containers/web-viewer/components/page.md) | Reviews the architecture in the browser | groma web |
