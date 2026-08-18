---
id: gateway
kind: container
parent: openclaw
---

# Gateway

The single long-lived control plane on the host (`ws://127.0.0.1:18789` by
default). It owns the typed WebSocket API for CLI, Control UI, and nodes,
serves the Control UI HTTP assets, and is the only process that opens
channel sessions. One Gateway per host; clients connect with a device
identity and, when configured, a token.

## Relationships

| Target | Description | Technology |
| --- | --- | --- |
| [Channels](../channels/container.md) | Maintains linked chat sessions and routes inbound messages and replies | In-process channel connections |
| [Agent Runtime](../agent-runtime/container.md) | Starts an assistant turn and streams agent events | Gateway agent RPC |
