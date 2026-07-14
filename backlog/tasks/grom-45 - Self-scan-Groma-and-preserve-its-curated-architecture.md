---
id: GROM-45
title: Self-scan Groma and preserve its curated architecture
status: To Do
assignee: []
created_date: '2026-07-14 19:58'
updated_date: '2026-07-14 20:00'
labels: []
milestone: m-3
dependencies:
  - GROM-32
  - GROM-43
  - GROM-49
references:
  - MANIFESTO.md
  - ARCHITECTURE.md
priority: high
type: task
ordinal: 42000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Prove the complete observe and reconcile boundary on Groma itself by comparing automatic TypeScript and Bun evidence with the canonical self-blueprint without allowing implementation facts to overwrite architectural meaning.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 A clean scanner run over Groma completes without AI or human correction and produces detailed package, public-action, dependency, route where present, documentation, and provenance evidence
- [ ] #2 Unambiguous evidence reuses valid bindings while uncertain or mismatched observations remain explainable automatic candidates rather than guessed matches
- [ ] #3 The scan preserves every curated intent field, pinned conceptual boundary, stable component identity, and relationship not owned by scanner evidence
- [ ] #4 An unchanged rescan is byte-stable and a representative implementation rename or move preserves identity when the binding evidence supports it
- [ ] #5 A coverage audit distinguishes intentional architectural abstraction from scanner omissions and records product gaps separately from implementation defects
- [ ] #6 The resulting raw CLI output is sufficient for a human or agent to inspect both curated architecture and its supporting implementation evidence
<!-- AC:END -->
