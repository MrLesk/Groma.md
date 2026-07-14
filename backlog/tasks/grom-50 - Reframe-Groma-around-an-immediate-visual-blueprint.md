---
id: GROM-50
title: Reframe Groma around an immediate visual blueprint
status: Done
assignee:
  - "@codex"
created_date: "2026-07-14 20:33"
updated_date: "2026-07-14 23:10"
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
- [x] #2 Canonical components and projected nodes are clearly distinguished, external is a conventional open component type, and lightweight label, summary, and iconDomain favicon-domain recognition metadata do not admit canonical layout or style state
- [x] #3 The architecture defines a bounded progressive visual projection with main-layer density, focus and detail views, folding, evidence-state distinction, structured inspection, and reconstructable local rendering
- [x] #4 The first-run target is an end-to-end local init, scan, and visual-understanding workflow delivered before nonessential generality or extreme-scale optimization
- [x] #5 Affected Backlog tasks and milestones encode the revised delivery order without weakening scanner blindness, stable identity, reconciliation, local ownership, or deterministic behavior
- [x] #6 AGENTS.md operationalizes the immediate-value and renderer-separation guardrails for future work

<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->

1. Define iconDomain as canonical recognition metadata with a deterministic offline badge, monogram, or text-hint use in the first renderer; prohibit renderer network requests and keep any future icon resolution outside GROM-51/GROM-52 behind explicit user action and privacy policy.
2. Document the shipped Iteration 1A bare-groma terminal overview and its Iteration 2 evolution, and clarify the architecture diagram so CLI owns renderer triggering/opening while bounded Shared Application Operations remain the renderer's only data source and the artifact returns to the CLI caller.
3. Split the Iteration 2 local-artifact presentation-budget freeze from the End-of-Iteration-4 browser retained-node freeze, with GROM-53 collecting organization-scale browser evidence for the later decision.
4. Make Iteration 2 release limits explicit in GROM-48: one active CLI process is supported while concurrent independent readers remain GROM-31's fail-closed limitation, and incompatible preview schemas fail closed without migration until GROM-27 with state-preservation/export guidance before upgrades.
5. Replace sibling dogfood references with the durable Backlog.md and codex-events remotes, keep task scopes coherent, expand semantic/dependency assertions, run formatting and the full repository check, re-finalize GROM-50, and commit within the unchanged 39-file branch scope.

<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->

Final-state attribution: GROM-50 owns the recovered Iteration 1B–3 roadmap baseline (milestones m-2 through m-4 and tasks GROM-21 through GROM-53) because acceptance criterion 5 owns affected roadmap sequencing and no earlier baseline is recoverable. The product trajectory keeps components as canonical meaning and nodes as disposable projections; adds optional label, one-sentence summary, favicon-domain recognition metadata, and conventional external type; defines a bounded renderer with focus, folding, tracing, and structured evidence inspection; and moves nonessential package, migration, concurrency, external-submission, extra-project, and extreme-scale work behind the first living visual release. Corrected dependencies remove deferred schema migration and package-management prerequisites where they do not provide required behavior.

Spec-review corrections route the Visual Blueprint Renderer exclusively through presentation-neutral bounded Shared Application Operations reads; split already-current bare-groma opening in GROM-52 from successful scan-to-visual transition in GROM-43; keep GROM-40 on representative bounded fixtures plus Groma coverage; defer organization-scale fanout evidence and strategy decisions to GROM-53; and replace stale Iteration 2 wording in GROM-44.

Quality-review corrections remove dangling references to the excluded dogfood record, preserve GROM-30's historical raw-query gap and GROM-31's historical concurrent-read failure as descriptive findings, use the canonical groma init -> groma scan -> groma first-minute workflow, standardize iconDomain authority limits, separate component/evidence shared operations from projected-node interaction, and clarify deferred package-management delivery.

Benchmark provenance correction: historical findings and the earlier Backlog.md run's 43 components, 83 relationships, five roots, and generation 77 are descriptive context only. GROM-34 owns the fresh durable reference audits, observable benchmark facts, scorecard rules, and pass/fail thresholds; GROM-46 depends on GROM-34 and must compare automatic output against that current audit rather than score the historical counts or curated meaning.

Projection-label correction: the label -> name -> stable canonical component ID fallback applies only to a projected node representing one component. Folded groups receive deterministic view-local labels derived from the grouping rule and bounded member count and never receive synthetic canonical component IDs or identity.

Final validation: Prettier passed the four files touched by this correction; git diff --check passed; backlog doctor found no duplicate IDs; 864 semantic, dependency, and scope assertions proved benchmark ownership, descriptive-only history, folded-label semantics, complete dependency existence, an acyclic task graph, no Iteration 1B/2 dependency on Iteration 3 work, all prior GROM-50 invariants, and the unchanged 39-file branch scope; bun run check passed formatting, TypeScript, architecture boundaries, 458 tests, native build, binary smoke, and Iteration 1A verification.

Claude-review product decisions: iconDomain remains canonical recognition metadata but the first renderer uses it only for a deterministic self-contained domain badge, monogram, or text hint and makes no network request; favicon fetching is outside GROM-51/GROM-52, and any future resolver requires explicit user action and a privacy policy. The shipped Iteration 1A bare groma terminal overview and the Iteration 2 disposable local artifact are successive presentations of the same shared operations, with the web app later replacing the artifact. CLI controls renderer triggering/opening while bounded Shared Application Operations remain its only data source and the artifact returns to the CLI caller. Iteration 2 freezes only local-artifact main-layer, focus, and expansion budgets; browser retained-node limits remain evidence-driven until the End of Iteration 4, with GROM-53 collecting organization-scale evidence. Iteration 2 supports the single-active-CLI-process path: concurrent independent readers remain GROM-31's known fail-closed limitation and must not corrupt canonical state. Iteration 2 also publishes a preview schema contract: incompatible schemas fail closed, no silent or in-place migration is promised before GROM-27, and upgrade guidance must explain state preservation/export. External dogfood tasks use the durable Backlog.md and codex-events GitHub remotes.

Claude-review correction validation: Prettier passed MANIFESTO.md, ARCHITECTURE.md, and eight affected task records; git diff --check passed; backlog doctor found no duplicate IDs; 908 semantic, dependency, and scope assertions proved deterministic offline iconDomain use and absolute renderer no-network behavior, split local/browser freeze points, explicit single-process and preview-schema release limits, current terminal-to-local-to-web entry-point evolution, CLI renderer control with Shared Application Operations data authority and CLI-caller delivery, durable external references, complete dependencies, an acyclic task graph, and the unchanged 39-file branch scope. bun run check passed formatting, TypeScript, architecture boundaries, 458 tests, native build, binary smoke, and Iteration 1A verification.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->

Reframed Groma around the immediate init-to-scan-to-visual blueprint loop and resolved the final product review: iconDomain has a deterministic offline first-renderer use with no network access; local and browser budget freezes are separated; Iteration 2 documents its single-process and preview-schema limits; shipped bare-groma evolution and renderer authority are explicit; and dogfood tasks use durable remotes. Verified with Prettier, 908 semantic/dependency/scope assertions, Backlog integrity, diff hygiene, and the full 458-test repository check.
<!-- SECTION:FINAL_SUMMARY:END -->
