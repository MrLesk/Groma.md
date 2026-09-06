---
type: Groma Relationships
title: Architecture relationships
---

## Relationships

| Source | Target | Description | Technology |
| --- | --- | --- | --- |
| [Operator](actors/operator.md) | [WhatsApp](externals/whatsapp.md) | Messages the assistant from a phone chat | WhatsApp |
| [Operator](actors/operator.md) | [Telegram](externals/telegram.md) | Messages the assistant from a bot chat | Telegram |
| [Operator](actors/operator.md) | [CLI](systems/openclaw/containers/cli/container.md) | Onboards, starts the Gateway, approves pairing, and sends agent turns | openclaw |
| [Operator](actors/operator.md) | [Control UI](systems/openclaw/containers/control-ui/container.md) | Chats, edits config, and watches sessions in a browser | Browser |
| [Operator](actors/operator.md) | [Node](systems/openclaw/containers/node/container.md) | Pairs a Mac, iPhone, or Android as a device for canvas, camera, and local exec | Companion app |
| [Agent Runtime](systems/openclaw/containers/agent-runtime/container.md) | [Anthropic](externals/anthropic.md) | Streams a completion for the current turn | Anthropic API |
| [Channels](systems/openclaw/containers/channels/container.md) | [WhatsApp](externals/whatsapp.md) | Links a WhatsApp Web session and exchanges messages | WhatsApp Web |
| [Channels](systems/openclaw/containers/channels/container.md) | [Telegram](externals/telegram.md) | Runs the bot and exchanges DMs and group messages | Telegram Bot API |
| [src/cli-implementation.ts](../src/cli-implementation.ts) | [src/gateway-implementation.ts](../src/gateway-implementation.ts) | Starts, inspects, and calls the control plane | openclaw gateway / Gateway WebSocket |
| [src/control-ui-implementation.ts](../src/control-ui-implementation.ts) | [src/gateway-implementation.ts](../src/gateway-implementation.ts) | Chats, reads status, and patches config | Gateway WebSocket |
| [src/gateway-implementation.ts](../src/gateway-implementation.ts) | [src/channels-implementation.ts](../src/channels-implementation.ts) | Maintains linked chat sessions and routes inbound messages and replies | In-process channel connections |
| [src/gateway-implementation.ts](../src/gateway-implementation.ts) | [src/agent-runtime-implementation.ts](../src/agent-runtime-implementation.ts) | Starts an assistant turn and streams agent events | Gateway agent RPC |
| [src/node-implementation.ts](../src/node-implementation.ts) | [src/gateway-implementation.ts](../src/gateway-implementation.ts) | Connects as a paired device and serves canvas, camera, and local exec | Gateway WebSocket |
