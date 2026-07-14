---
id: GROM-50
title: Reframe Groma around an immediate visual blueprint
status: Done
assignee:
  - '@codex'
created_date: '2026-07-14 20:33'
updated_date: '2026-07-14 22:12'
labels:
  - product
  - architecture
  - first-run
  - visualization
dependencies: []
references:
  - MANIFESTO.md
  - ARCHITECTURE.md
  - AGENTS.md
modified_files:
  - MANIFESTO.md
  - ARCHITECTURE.md
  - AGENTS.md
priority: high
type: task
ordinal: 47000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Make Groma useful and legible in the first minute: users define architectural intent, delegate implementation externally, and rely on scanners and reconciliation to keep the blueprint current. Persist the simplified node/component vocabulary, bounded progressive visual model, reconstructable renderer boundary, and a vertical init-to-scan-to-visual first-run trajectory in the project constitution, architecture, delivery instructions, and affected roadmap tasks.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 The manifesto defines Groma as the place where intent is made explicit for delegated implementation and scanners prevent that blueprint from becoming stale
- [x] #2 Canonical components and projected nodes are clearly distinguished, external is a conventional open component type, and lightweight label, summary, and favicon-domain metadata do not admit canonical layout or style state
- [x] #3 The architecture defines a bounded progressive visual projection with main-layer density, focus and detail views, folding, evidence-state distinction, structured inspection, and reconstructable local rendering
- [x] #4 The first-run target is an end-to-end local init, scan, and visual-understanding workflow delivered before nonessential generality or extreme-scale optimization
- [x] #5 Affected Backlog tasks and milestones encode the revised delivery order without weakening scanner blindness, stable identity, reconciliation, local ownership, or deterministic behavior
- [x] #6 AGENTS.md operationalizes the immediate-value and renderer-separation guardrails for future work
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. Reconstruct the approved GROM-50 manifesto, architecture, delivery guardrails, and Iteration 1B–3 roadmap baseline on origin/main without the later brand overlay.
2. Correct roadmap dependencies so deferred Iteration 3 work does not block the Iteration 1B or 2 vertical slice, while retaining functional prerequisites.
3. Keep GROM-52 presentation-neutral and bounded: shared reads, progressive focus/folding, evidence inspection, deterministic local rendering, and no canonical presentation state.
4. Validate all six acceptance criteria with scripted cross-document and dependency assertions, formatting, Backlog integrity, repository checks, and final diff review.
5. Record objective evidence, finalize GROM-50 through Backlog CLI, and commit only the authorized scope.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Final-state attribution: GROM-50 owns the recovered Iteration 1B–3 roadmap baseline (milestones m-2 through m-4 and tasks GROM-21 through GROM-53) because acceptance criterion 5 owns affected roadmap sequencing and no earlier baseline is recoverable. The product trajectory treats components as canonical meaning and nodes as disposable projections; adds optional label, one-sentence summary, favicon-domain recognition metadata, and conventional external type; defines a self-contained bounded renderer with focus, folding, tracing, and structured evidence inspection; and moves nonessential package, migration, concurrency, external-submission, extra-project, and extreme-scale work behind the first living visual release. Corrected dependencies by removing deferred schema migration from GROM-28, GROM-36, and GROM-37 and deferred package management from GROM-38 while retaining functional prerequisites. Restored GROM-52 to its presentation-neutral bounded local renderer scope.

Validation evidence: Prettier passed all 39 changed Markdown and Backlog files; git diff --check passed; backlog doctor found no duplicate IDs; a 107-assertion Bun consistency check proved acceptance-criteria terminology, required roadmap coverage, corrected dependencies, no Iteration 1B/2 dependency on Iteration 3 work, renderer scope, and exclusion of out-of-scope task records and brand overlay; bun run check passed formatting, TypeScript, architecture boundaries, 458 tests, native build, binary smoke, and Iteration 1A verification after lockfile-pinned dependency installation.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Reframed Groma around the immediate local init-to-scan-to-visual blueprint loop; separated canonical components from disposable projected nodes; defined the bounded evidence-aware local renderer; recovered and resequenced the Iteration 1B–3 roadmap baseline; corrected deferred dependencies; and verified the 39-file docs-only change with Prettier, 107 consistency assertions, Backlog integrity, diff hygiene, and the full 458-test repository check.
<!-- SECTION:FINAL_SUMMARY:END -->
