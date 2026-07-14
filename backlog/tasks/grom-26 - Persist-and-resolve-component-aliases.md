---
id: GROM-26
title: Persist and resolve component aliases
status: To Do
assignee: []
created_date: '2026-07-14 19:57'
labels: []
milestone: m-2
dependencies: []
references:
  - MANIFESTO.md
  - ARCHITECTURE.md
priority: high
type: feature
ordinal: 23000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Preserve stable architectural references when components merge or observation keys migrate by making supersession a durable, deterministic part of canonical identity resolution.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 A canonical alias can supersede an obsolete component ID with a surviving component ID without changing the survivor identity
- [ ] #2 Reads, relationships, and later bindings resolve valid alias chains deterministically after process restart
- [ ] #3 Alias cycles, missing targets, self-aliases, and ambiguous supersession fail closed without canonical changes
- [ ] #4 Alias records are human-readable, deterministically serialized, and remain separate from component intent documents
- [ ] #5 Moving or renaming a component does not create an alias, while an explicit merge preserves old references through one
<!-- AC:END -->
