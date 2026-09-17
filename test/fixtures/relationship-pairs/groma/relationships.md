---
type: Groma Relationships
title: Architecture relationships
---

## Relationships

| Source | Target | Description | Technology |
| --- | --- | --- | --- |
| [src/talks.ts](../src/talks.ts) | [src/sessions.ts](../src/sessions.ts) | Loads sessions | HTTPS |
| [src/talks.ts](../src/talks.ts) | [src/people.ts](../src/people.ts) | Loads people | HTTPS |
| [src/speakers.ts](../src/speakers.ts) | [src/people.ts](../src/people.ts) | Loads people | HTTPS |
| [src/sessions.ts](../src/sessions.ts) | [src/talks.ts](../src/talks.ts) | Pushes schedule changes | Webhook |
