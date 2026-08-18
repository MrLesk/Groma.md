---
id: doc-2
title: OpenClaw upper-band semantic layout
type: other
created_date: '2026-08-18 19:48'
updated_date: '2026-08-18 20:08'
---
# OpenClaw as an upper-band layout fixture

Date: 2026-08-18  
Question: Do collapse and pin-on-Enter hold on a real product larger than Shop?

## Correction

The first pass inventoried `/Users/alex/projects/openclaw/groma/`. That tree is an old scanner dump and is **not** the fixture. Groma 3 cannot load it.

The fixture is a **new** Groma 3 C4 world authored from OpenClaw product docs (`docs/concepts/architecture.md`, README), written to `test/fixtures/openclaw-view/`. It never copies `ent_*` ids, npm stubs, or `groma/components`.

When an operator uses WhatsApp, OpenClaw shows the assistant’s reply on that same chat.

## Authored world (TASK-94)

| Kind | Count | Names |
| --- | ---: | --- |
| Person | 1 | Operator |
| Internal system | 1 | OpenClaw |
| External systems | 3 | WhatsApp, Telegram, Anthropic |
| Containers | 6 | Gateway, Channels, Agent Runtime, CLI, Control UI, Node |
| Components | 0 | — |
| Relationships | 13 | operator → chats/clients; clients → Gateway; Gateway → Channels and Agent Runtime; Channels → WhatsApp/Telegram; Agent Runtime → Anthropic |

## Layout on that fixture

| Stage | OpenClaw |
| --- | --- |
| Full-nest world | 297×180 (city 596×327) |
| Fresh ELK Context | **44×40** |
| Fresh ELK after Enter | 209×180 |
| Pinned after Enter | 237×264 at the **same** origin |

Fresh ELK origin deltas, Context → Containers:

| Item | Δ |
| --- | --- |
| OpenClaw | 32 |
| Operator | 95 |
| WhatsApp | 193 |
| Telegram | 170 |
| Anthropic | 193 |

Pinned deltas: all **0**.

Pinned OpenClaw overlaps 8 items (its six containers plus Anthropic and Telegram). Same shape as Shop/Vault: Context parks externals against a compact system, then the plate grows over them.

## What this means for upper-band decisions

1. A docs-authored 11-element OpenClaw is the right upper-band fixture: bigger than Shop, still one system.
2. Collapse still works (44×40 vs 297×180).
3. Pin-on-Enter still holds origins.
4. Overlap on grow is now the decision, even at this honest size. Not unique to the scanner dump.
5. Do not use the 212-file dump. Do not add npm libraries as systems.

## Checks

`bun test test-bun/openclaw-view.test.ts` — 2 pass.
