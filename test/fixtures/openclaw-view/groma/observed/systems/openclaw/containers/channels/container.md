---
type: C4 Container
title: Channels
status: stable
groma:
  id: channels
  parent: openclaw
---

The messaging edge the Gateway owns. This world keeps the two onboarding
paths the docs treat as first-class: WhatsApp Web and Telegram. DM pairing
and allowlists sit on this edge.

## Relationships

| Target | Description | Technology |
| --- | --- | --- |
| [WhatsApp](../../../whatsapp/system.md) | Links a WhatsApp Web session and exchanges messages | WhatsApp Web |
| [Telegram](../../../telegram/system.md) | Runs the bot and exchanges DMs and group messages | Telegram Bot API |
