---
id: GROM-46
title: Automatically blueprint Backlog.md
status: To Do
assignee: []
created_date: '2026-07-14 19:58'
updated_date: '2026-07-14 20:37'
labels: []
milestone: m-4
dependencies:
  - GROM-34
  - GROM-43
references:
  - MANIFESTO.md
  - ARCHITECTURE.md
  - backlog/tasks/grom-20 - Dogfood-Groma-against-Backlog.md.md
  - ../backlog.md/MANIFESTO.md
priority: high
type: task
ordinal: 43000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Repeat the Backlog.md dogfood exercise from a clean source snapshot using only the automatic Groma workflow, then compare the evidence-grounded result with the earlier AI-curated audit without expecting invented domain labels or prose.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 A disposable clean Backlog.md snapshot with no prior Groma artifacts is initialized, scanned, reconciled, and exported without AI or human correction during the workflow
- [ ] #2 The automatic result passes the Backlog.md benchmark for major workspace boundaries, public actions, cross-boundary dependencies, Bun routes where present, documentation evidence, provenance, and forbidden claims
- [ ] #3 Comparison with GROM-20 scores only defensible observable facts and explicitly excludes Codex-authored domain names and curated intent from scanner expectations
- [ ] #4 An unchanged rescan is byte-stable and failed or interrupted rescans preserve the last complete blueprint
- [ ] #5 The source snapshot remains unmodified outside its Groma workspace and the real Backlog.md worktree and unrelated changes remain untouched
- [ ] #6 Findings distinguish benchmark gaps, scanner or reconciliation defects, product limitations, and source-project ambiguity
<!-- AC:END -->
