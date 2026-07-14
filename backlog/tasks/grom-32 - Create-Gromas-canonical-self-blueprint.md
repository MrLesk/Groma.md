---
id: GROM-32
title: Create Groma's canonical self-blueprint
status: To Do
assignee: []
created_date: '2026-07-14 19:57'
updated_date: '2026-07-14 20:38'
labels: []
milestone: m-2
dependencies:
  - GROM-22
  - GROM-26
  - GROM-30
  - GROM-51
references:
  - MANIFESTO.md
  - ARCHITECTURE.md
priority: high
type: task
ordinal: 29000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Replace the handmade architecture overview as the detailed source of truth by representing the complete documented Groma architecture in a canonical Groma workspace through supported public operations.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 The repository contains a canonical Groma workspace with the nine documented root components and one recursively nested component for every architecture card
- [ ] #2 Every component preserves its documented type, parent, intent, inputs, outputs, actions, relationships, and seed key migration metadata
- [ ] #3 All canonical content is created through supported Groma operations rather than hand-edited canonical Markdown or private APIs
- [ ] #4 A coverage audit finds no component card or declared architectural relationship missing from the self-blueprint
- [ ] #5 The self-blueprint reloads deterministically and supports bounded detailed export through the public CLI
- [ ] #6 ARCHITECTURE.md becomes the navigational entry point and documents the explicit process for resolving disagreements without remaining a second detailed source of truth
<!-- AC:END -->
