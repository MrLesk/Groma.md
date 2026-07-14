---
id: GROM-50
title: Reframe Groma around an immediate visual blueprint
status: Done
assignee:
  - '@codex'
created_date: '2026-07-14 20:33'
updated_date: '2026-07-14 22:24'
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
1. Correct the architecture flow so the bounded Visual Blueprint Renderer consumes Shared Application Operations only, never Projection Index or storage directly.
2. Remove the GROM-43/GROM-52 acceptance-level cycle by assigning current-artifact opening to GROM-52 and first-run scan-to-visual integration to GROM-43.
3. Keep Iteration 2 proof bounded: make GROM-40 use representative TypeScript/Bun or Groma-self fixtures, make GROM-48 verify the initial bounded evidence strategy while deferring organization-scale fanout proof to GROM-53, and make GROM-44 wording milestone-neutral.
4. Expand scripted consistency and dependency checks to prove renderer authority, acyclic task ownership, bounded scanner/release proof, deferred organization-scale work, and current-evidence wording.
5. Rerun formatting, diff hygiene, Backlog integrity, full repository checks, finalize all six acceptance criteria with objective evidence, and commit the review corrections without changing scope.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Final-state attribution: GROM-50 owns the recovered Iteration 1B–3 roadmap baseline (milestones m-2 through m-4 and tasks GROM-21 through GROM-53) because acceptance criterion 5 owns affected roadmap sequencing and no earlier baseline is recoverable. The product trajectory treats components as canonical meaning and nodes as disposable projections; adds optional label, one-sentence summary, favicon-domain recognition metadata, and conventional external type; defines a self-contained bounded renderer with focus, folding, tracing, and structured evidence inspection; and moves nonessential package, migration, concurrency, external-submission, extra-project, and extreme-scale work behind the first living visual release. Corrected dependencies by removing deferred schema migration from GROM-28, GROM-36, and GROM-37 and deferred package management from GROM-38 while retaining functional prerequisites. Restored GROM-52 to its presentation-neutral bounded local renderer scope.

Validation evidence: Prettier passed all 39 changed Markdown and Backlog files; git diff --check passed; backlog doctor found no duplicate IDs; a 107-assertion Bun consistency check proved acceptance-criteria terminology, required roadmap coverage, corrected dependencies, no Iteration 1B/2 dependency on Iteration 3 work, renderer scope, and exclusion of out-of-scope task records and brand overlay; bun run check passed formatting, TypeScript, architecture boundaries, 458 tests, native build, binary smoke, and Iteration 1A verification after lockfile-pinned dependency installation.

Spec-review correction pass: routed the Visual Blueprint Renderer exclusively from presentation-neutral bounded Shared Application Operations reads in both the architecture flow and component relationship, eliminating direct Projection Index, storage, and Query Engine authority. Broke the acceptance-level workflow cycle by making GROM-52 own bare groma reconstruction/opening for an already-current blueprint generation and GROM-43 own successful interactive scan-to-visual integration. Replaced GROM-40 external-project benchmark requirements with representative bounded TypeScript/Bun fixtures and Groma self coverage while assigning later dogfood to GROM-46/GROM-47. Made GROM-48 verify the initial 256-bucket strategy and defer organization-scale fanout evidence and decision to GROM-53, whose acceptance criteria now explicitly record that decision from organization-scale evidence. Replaced GROM-44 stale Iteration 2 language with current-blueprint and preserved-existing-evidence wording.

Correction validation: Prettier passed all eight files changed by the review pass; git diff --check passed; backlog doctor found no duplicate IDs; a 221-assertion expanded Bun consistency check proved all five semantic inversions, complete dependency existence, an acyclic task graph, no Iteration 1B/2 dependency on Iteration 3 work, and the original GROM-50 invariants; bun run check passed formatting, TypeScript, architecture boundaries, 458 tests, native build, binary smoke, and Iteration 1A verification.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Reframed Groma around the immediate local init-to-scan-to-visual blueprint loop and corrected spec-review findings: renderers now consume bounded shared application reads only, scan/render task ownership is acyclic, Iteration 2 scanner and release proof remains bounded, organization-scale fanout is owned by GROM-53, and external-observation evidence wording matches its Iteration 3 placement. Verified with Prettier, 221 consistency and dependency assertions, Backlog integrity, diff hygiene, and the full 458-test repository check.
<!-- SECTION:FINAL_SUMMARY:END -->
