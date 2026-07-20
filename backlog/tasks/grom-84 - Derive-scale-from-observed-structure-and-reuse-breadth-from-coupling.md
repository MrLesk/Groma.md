---
id: GROM-84
title: Derive scale from observed structure and reuse breadth from coupling
status: Done
assignee:
  - '@claude'
created_date: '2026-07-20 20:57'
updated_date: '2026-07-20 21:08'
labels:
  - pivot
  - reconciliation
milestone: m-5
dependencies: []
priority: high
type: feature
ordinal: 81000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Scale proposals today are unusable: absolute file-count thresholds (part 8, domain 40, system 160) make the domain and system rungs unreachable in this repository, reuseBreadth is used as a size signal so node:fs is proposed as a part of our architecture, any two signals disagreeing vetoes the proposal (three of eight real boundaries), and the one component that is the system scores insufficient. Replace the primary derivation with position in the observed containment forest, which is generic across languages and self-adjusts to how much structure a project actually has. Move reuseBreadth to the shared flag, where breadth of use belongs. Externals get no scale, because their internal size is unobservable.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Scale is derived primarily from depth in the observed containment forest, clamped to the closed ladder, with no language or packaging vocabulary in the rule
- [x] #2 reuseBreadth no longer contributes to scale and instead proposes the shared flag
- [x] #3 Candidates with no observed containment, including externals, receive no scale proposal
- [x] #4 Observed scale and shared reach the component as evidence-owned values that curation overrides and rescans never fight
- [x] #5 A scan of this repo scales every source boundary and the root package; bun run check stays green
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
observedScaleForDepth places a component on the closed ladder by its depth in the observed containment forest, clamped to the finest rung (the model permits same-scale nesting, so deep trees simply repeat the last rung). The rule names no packaging or language concept and is relative by construction: a project with fewer structural levels uses fewer rungs instead of being measured against absolute sizes it can never reach. This replaced thresholds under which the domain and system rungs were unreachable in this repository (part 8, domain 40, system 160 files against a 71-file repo), which is why every boundary previously landed unscaled or ambiguous. reuseBreadth left the scale computation entirely and now proposes the shared flag through observedSharedFromSignals at a breadth of two distinct containers, which is what breadth of use actually measures; that alone removed the false proposals that made node:fs a part of our architecture and the unanimity vetoes that left persistence, host, and standard-model unscaled. Components with no observed containment, including every external, receive no scale. The v1 count-threshold derivation stays in place for the evidence-side scale assessment and curation-drift reporting. Evidence: a self-scan gives groma system, all eight boundaries domain (one rung higher than a monorepo would place them, because this repository genuinely has one less structural level), and shared true for core, application, standard-model and the widely used externals; bun run check green at 449 tests.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Scale now comes from where a component sits in the structure a scanner observed rather than from absolute file counts, and breadth of use marks sharing rather than size. Every source boundary in this repository is scaled and placed by scan alone.
<!-- SECTION:FINAL_SUMMARY:END -->
