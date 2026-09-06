---
type: C4 Container
title: Gateway
status: stable
groma:
  id: gateway
  parent: openclaw
---

The single long-lived control plane on the host (`ws://127.0.0.1:18789` by
default). It owns the typed WebSocket API for CLI, Control UI, and nodes,
serves the Control UI HTTP assets, and is the only process that opens
channel sessions. One Gateway per host; clients connect with a device
identity and, when configured, a token.
