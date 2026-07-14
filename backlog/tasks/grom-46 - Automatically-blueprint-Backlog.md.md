---
id: GROM-46
title: Automatically blueprint Backlog.md
status: To Do
assignee: []
created_date: "2026-07-14 19:58"
updated_date: "2026-07-14 23:05"
labels: []
milestone: m-4
dependencies:
  - GROM-34
  - GROM-43
references:
  - MANIFESTO.md
  - ARCHITECTURE.md
  - "https://github.com/MrLesk/Backlog.md"
priority: high
type: task
ordinal: 43000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->

Repeat the Backlog.md dogfood exercise from a clean source snapshot using only the automatic Groma workflow, then compare the evidence-grounded result against a fresh, durable GROM-34 reference audit and scorecard. The earlier AI-curated run's 43 components, 83 relationships, five domain roots, and generation 77 are descriptive historical context only; they define neither benchmark facts nor pass/fail thresholds.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria

<!-- AC:BEGIN -->

- [ ] #1 A disposable clean Backlog.md snapshot with no prior Groma artifacts is initialized, scanned, reconciled, and exported without AI or human correction during the workflow
- [ ] #2 The automatic result is evaluated against a fresh durable GROM-34 reference audit and passes its scorecard for major workspace boundaries, public actions, cross-boundary dependencies, Bun routes where present, documentation evidence, provenance, and forbidden claims
- [ ] #3 The automatic output is compared with the GROM-34 reference audit using its false-claim, observable-fact coverage, determinism, stable-identity, provenance, time-to-visual, and comprehension scoring rules; historical counts, curated labels, and curated intent are excluded from pass/fail
- [ ] #4 An unchanged rescan is byte-stable and failed or interrupted rescans preserve the last complete blueprint
- [ ] #5 The source snapshot remains unmodified outside its Groma workspace and the real Backlog.md worktree and unrelated changes remain untouched
- [ ] #6 Findings distinguish benchmark gaps, scanner or reconciliation defects, product limitations, and source-project ambiguity

<!-- AC:END -->
