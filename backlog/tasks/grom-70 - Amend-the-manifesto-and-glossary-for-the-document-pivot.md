---
id: GROM-70
title: Amend the manifesto and glossary for the document pivot
status: Done
assignee:
  - '@claude'
created_date: '2026-07-20 17:43'
updated_date: '2026-07-20 17:55'
labels:
  - pivot
  - docs
milestone: m-5
dependencies: []
references:
  - MANIFESTO.md
  - docs/interface-glossary.md
priority: high
type: docs
ordinal: 67000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Records the explicit product decision (Alex, 2026-07-20) behind the pivot inspired by the expert-career-path editor: document-first canonical files, a closed component scale axis, an editing web surface, and a static export bundle. The manifesto currently pins the component type token as fully open and canonical state as Markdown; both statements need deliberate amendment, not silent reinterpretation. Scale joins as a separate closed structural axis (system/domain/part/element) beside the open type token, which stays open for flavor words. Evidence wording distinguishes human-readable Markdown for meaning from deterministic JSON for machine evidence, both canonical under groma/. Root becomes purely structural (no implied bigness). Project and system stay distinct concepts. Glossary follows: scale and shared join the surface vocabulary; source-boundary and external leave it (they move to evidence-signal and ownership-flag vocabulary).
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 MANIFESTO.md component-model section defines the closed scale axis (system/domain/part/element), same-scale nesting, and the child-never-coarser containment rule, while the type token stays open for flavor
- [x] #2 MANIFESTO.md source-of-truth section distinguishes human-readable Markdown for intent and plans from deterministic JSON for machine evidence, both canonical under groma/
- [x] #3 docs/interface-glossary.md gains scale and shared with plain-word meanings and drops source-boundary and external from surface vocabulary
- [x] #4 The amendment states that project (a codebase Groma may look at) and system (the curated top-level component) remain distinct
- [x] #5 No code or behavior changes ride along with the amendment
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. Amend MANIFESTO.md component model: closed scale axis (system/domain/part/element, child never coarser, same-scale nesting, unscaled legal and never guessed), shared flag, root purely structural, ownership as explicit flag instead of reserved external type, project vs system distinction.
2. Amend the source-of-truth section: Markdown for meaning (intent, plans), deterministic JSON for machine evidence, both canonical under groma/.
3. Add the measurement-not-classification scanner sentence to the evidence posture.
4. Update docs/interface-glossary.md: scale and shared join nouns and plain narration; source-boundary and external stay off surfaces.
5. bun run check; strictly no code changes.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Amended MANIFESTO.md in three places: (1) component model — closed scale ladder system/domain/part/element with child-never-coarser and same-scale nesting, unscaled as the legal undecided state that is never guessed, explicit shared flag, root made purely structural, ownership an explicit flag instead of a reserved external type token, and the project-vs-system distinction stated; (2) evidence posture — scanners measure, never classify (measurements are evidence; meaning, including scale, is reconciliation and curation); (3) source of truth — canonical state under groma/ in two honest formats, readable named Markdown documents for meaning and deterministic JSON for machine evidence. Glossary: scale and shared join the nouns (8 to 10) and plain narration (plus unscaled), new design note 7 records the 2026-07-20 decision keeping source-boundary (evidence vocabulary) and external (ownership flag) off surfaces, own-word count updated to six. Verified the glossary contained no source-boundary or external surface rows to remove. No code changed; bun run check green through the compiled Iteration 1A workflow.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
The manifesto now carries the document-pivot product decision: a closed curated scale axis beside the open type token, measurement-not-classification as scanner law, and a two-format source of truth (Markdown for meaning, JSON for evidence). The glossary gained scale and shared with plain words and recorded why source-boundary and external stay off surfaces. Docs only — every code change remains with GROM-71 through GROM-81.
<!-- SECTION:FINAL_SUMMARY:END -->
