---
id: control-ui
kind: container
parent: openclaw
---

# Control UI

The browser dashboard served by the Gateway on the same port
(`http://127.0.0.1:18789/`). It chats, shows channel and node status, and
edits config and sessions over the Gateway WebSocket.

## Relationships

| Target | Description | Technology |
| --- | --- | --- |
| [Gateway](../gateway/container.md) | Chats, reads status, and patches config | Gateway WebSocket |
