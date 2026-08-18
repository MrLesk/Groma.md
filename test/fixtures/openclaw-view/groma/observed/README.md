# Observed architecture

OpenClaw is the personal assistant. The operator talks on WhatsApp or Telegram
and operates from the CLI, Control UI, or a paired node.

- [Operator](people/operator.md) messages the assistant and runs the Gateway.
- [OpenClaw](systems/openclaw/system.md) is the self-hosted assistant.
- [Gateway](systems/openclaw/containers/gateway/container.md) is the control plane.
- [Channels](systems/openclaw/containers/channels/container.md) hold chat sessions.
- [Agent Runtime](systems/openclaw/containers/agent-runtime/container.md) runs a turn.
- [WhatsApp](systems/whatsapp/system.md), [Telegram](systems/telegram/system.md),
  and [Anthropic](systems/anthropic/system.md) are the product surfaces it talks to.
