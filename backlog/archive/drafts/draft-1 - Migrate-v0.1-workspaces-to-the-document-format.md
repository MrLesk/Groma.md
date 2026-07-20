---
id: DRAFT-1
title: Migrate v0.1 workspaces to the document format
status: In Progress
assignee:
  - '@codex'
created_date: '2026-07-20 17:44'
updated_date: '2026-07-20 19:56'
labels:
  - pivot
  - persistence
  - cli
milestone: m-5
dependencies:
  - GROM-72
  - GROM-73
priority: high
type: feature
ordinal: 71000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
A one-shot groma migrate command converts a v0.1 workspace — hash-sharded intent files plus the fenced evidence blob — into the document format delivered by GROM-72 and GROM-73. Identity is sacred: every component id, alias, relationship, binding, and evidence record survives unchanged. The command is idempotent and fail-closed: unknown or malformed content stops the migration and leaves the workspace untouched rather than guessing. The proof is self-hosting: this repo's own groma/ workspace is migrated with the command in the same change and passes a scan and read round-trip afterwards.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 groma migrate converts a v0.1 workspace to the document format with every component id, alias, relationship, binding, and evidence record preserved
- [ ] #2 Running migrate twice is a no-op, and unknown or malformed content stops the migration untouched with an actionable diagnostic
- [ ] #3 Reading an unmigrated workspace with the new binary produces an actionable diagnostic naming groma migrate
- [ ] #4 This repo's own groma/ workspace is migrated via the command in the same change and passes a scan plus read round-trip
- [ ] #5 bun run check stays green
<!-- AC:END -->
