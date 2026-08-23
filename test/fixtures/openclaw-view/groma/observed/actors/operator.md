---
id: operator
kind: actor
---

# Operator

Runs a personal OpenClaw on their own machine. They message the assistant on
the chats they already use, and they onboard, pair, and inspect the Gateway
from the CLI, Control UI, or a companion node.

## Relationships

| Target | Description | Technology |
| --- | --- | --- |
| [WhatsApp](../systems/whatsapp/system.md) | Messages the assistant from a phone chat | WhatsApp |
| [Telegram](../systems/telegram/system.md) | Messages the assistant from a bot chat | Telegram |
| [CLI](../systems/openclaw/containers/cli/container.md) | Onboards, starts the Gateway, approves pairing, and sends agent turns | openclaw |
| [Control UI](../systems/openclaw/containers/control-ui/container.md) | Chats, edits config, and watches sessions in a browser | Browser |
| [Node](../systems/openclaw/containers/node/container.md) | Pairs a Mac, iPhone, or Android as a device for canvas, camera, and local exec | Companion app |
