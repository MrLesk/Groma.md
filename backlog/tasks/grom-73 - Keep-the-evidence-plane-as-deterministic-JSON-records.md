---
id: GROM-73
title: Keep the evidence plane as deterministic JSON records
status: To Do
assignee: []
created_date: '2026-07-20 17:44'
labels:
  - pivot
  - persistence
milestone: m-5
dependencies:
  - GROM-70
priority: high
type: feature
ordinal: 70000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Evidence is machine data and stops pretending to be Markdown: today groma/evidence.md is roughly three thousand lines of JSON inside a code fence, unreadable and unreviewable. Evidence moves to plain deterministic JSON files under groma/, with stable ordering and bounded sharding so a routine rescan produces focused diffs (the git-churn risk named in the manifesto). Markdown remains the format for meaning — intent and plans; JSON becomes the honest format for observation records. Wording change is covered by the manifesto amendment (GROM-70); this task is the persistence change.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 Evidence persists as plain deterministic JSON under groma/ with stable key and array ordering, replacing the fenced JSON-in-Markdown file
- [ ] #2 Evidence files stay bounded and sharded so a routine rescan yields focused reviewable diffs
- [ ] #3 Write and read round-trips lose no evidence data and the intent plane is untouched
- [ ] #4 bun run check stays green including the crash-recovery gates
<!-- AC:END -->
