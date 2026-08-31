---
type: C4 Container
title: CLI
status: stable
groma:
  id: cli
  parent: openclaw
---

The `openclaw` command the docs recommend for first run. It onboards the
Gateway and workspace, installs the daemon, approves pairing, and can send
a message or an agent turn. It talks to the same WebSocket control plane as
the other operator clients.

## Relationships

| Target | Description | Technology |
| --- | --- | --- |
| [Gateway](../gateway/container.md) | Starts, inspects, and calls the control plane | openclaw gateway / Gateway WebSocket |
