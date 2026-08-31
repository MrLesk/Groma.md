---
type: C4 Container
title: Agent Runtime
status: stable
groma:
  id: agent-runtime
  parent: openclaw
---

The embedded agent loop the Gateway runs for a session: workspace files,
skills, tools, and streamed model output. Session transcripts stay under
OpenClaw's agent store.

## Relationships

| Target | Description | Technology |
| --- | --- | --- |
| [Anthropic](../../../anthropic/system.md) | Streams a completion for the current turn | Anthropic API |
