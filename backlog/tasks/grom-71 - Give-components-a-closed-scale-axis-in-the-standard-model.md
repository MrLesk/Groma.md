---
id: GROM-71
title: Give components a closed scale axis in the standard model
status: To Do
assignee: []
created_date: '2026-07-20 17:44'
labels:
  - pivot
  - model
  - cli
milestone: m-5
dependencies:
  - GROM-70
priority: high
type: feature
ordinal: 68000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Components gain a curated scale property from a closed set — system, domain, part, element — plus an explicit shared flag, both intent (never scanner-written). This is the atomic-design lesson folded into Groma without the chemistry: a closed vocabulary of granularity with containment rules, so every surface can say how big a thing is. Rules: a child is never coarser than its parent; same-scale nesting is allowed; absent scale is legal (unscaled) and is never guessed or defaulted — it surfaces as a curation prompt. The open type token is untouched and stays flavor only. Depends on the manifesto amendment (GROM-70).
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 The standard model validates scale against the closed set and rejects any child coarser than its parent on create, update, and move, with actionable diagnostics
- [ ] #2 Absent scale stays legal as unscaled and is never defaulted, inferred, or guessed
- [ ] #3 shared is an explicit boolean flag orthogonal to scale and to the open type token
- [ ] #4 CLI component create and update accept scale and shared, and roots, children, get, search, and export expose and filter by them
- [ ] #5 Deterministic serialization covers both fields and bun run check stays green
<!-- AC:END -->
