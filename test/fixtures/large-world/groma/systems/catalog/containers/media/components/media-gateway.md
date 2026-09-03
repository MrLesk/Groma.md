---
type: C4 Component
title: Media gateway
status: stable
groma:
  id: media-gateway
  parent: media
  group: Core
  code:
    - scanner: typescript
      file: src/catalog/media/gateway.ts
      symbol: gateway
---

Media gateway of Media.

## Relationships

| Target | Description | Technology |
| --- | --- | --- |
| [media-router](media-router.md) | Calls router | HTTP |
| [media-session](media-session.md) | Reads session | HTTP |
| [accounts-gateway](../../../../identity/containers/accounts/components/accounts-gateway.md) | Forwards requests | HTTP |
