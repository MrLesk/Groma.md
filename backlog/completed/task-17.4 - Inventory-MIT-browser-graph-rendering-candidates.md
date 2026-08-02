---
id: TASK-17.4
title: Inventory MIT browser graph-rendering candidates
status: Done
assignee:
  - '@codex'
created_date: '2026-07-30 16:30'
updated_date: '2026-07-30 17:11'
labels: []
dependencies: []
references:
  - groma/experiments/04-semantic-zoom-viewer/library-selection.md
modified_files:
  - groma/experiments/04-semantic-zoom-viewer/candidate-inventory.md
  - groma/experiments/04-semantic-zoom-viewer/library-selection.md
  - groma/plans/04-semantic-zoom-viewer/README.md
  - test/architecture-reader.test.mjs
parent_task_id: TASK-17
priority: high
type: spike
ordinal: 21000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
When an evaluator follows Revision 04's linked rendering experiment, it contains a repeatable inventory of reusable browser graph and diagram libraries rather than a shortlist chosen from memory. The inventory records every relevant project returned by the approved registry, GitHub, established-list, repository, and dependency searches; identifies the independent rendering engine behind wrappers; and keeps non-eligible projects visible with evidence. A result is relevant when its official metadata describes a reusable browser library that renders graph or diagram nodes and relationships or provides that rendering foundation. Raw query counts and hashes preserve the broader search evidence. Popularity, stars, age, and familiarity are not filters. This task establishes the candidate universe only and does not select or implement a renderer.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 The inventory records every discovery source and exact search term plus raw-result counts and hashes, and a repeated discovery pass introduces no new independent rendering engine.
- [x] #2 Every relevant reusable browser graph or diagram project is classified as an independent renderer, wrapper, layout-only library, general drawing engine, static generator, framework-specific renderer, or commercial/non-MIT product; irrelevant apps, CLIs, server SDKs, unrelated charts, and domain products are represented by the raw search evidence rather than candidate rows.
- [x] #3 Each inventory entry records its package or repository identity, current version when packaged, license evidence, underlying renderer, and proof eligibility.
- [x] #4 An independent candidate is proof-eligible only when it is MIT-licensed, browser-usable, renders nodes and relationships through public APIs, and installs on Groma’s current toolchain; every other entry remains visible with its reason.
- [x] #5 React Flow, G6, MSAGL, and every newly discovered candidate are represented without naming a winner.
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [x] #1 Acceptance criteria have objective verification evidence.
- [x] #2 Relevant checks pass and changes remain task-scoped.
- [x] #3 Public contracts or documentation are updated when behavior changes.
- [x] #4 Implementation Plan reflects the final approach; correction history and verification are recorded in Implementation Notes.
<!-- DOD:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. Freeze the approved repeatable discovery sources, exact commands, normalization rules, and evidence cut-off from the rendering selection experiment.
2. Normalize every relevant reusable browser graph or diagram project into one inventory row with package or repository identity, current version, license evidence, approved category, underlying engine, and proof eligibility; retain irrelevant raw hits through source counts and hashes rather than candidate rows.
3. Publish the inventory as Markdown under groma/experiments and link it from Revision 04 without turning research documents into C4 components.
4. Repeat the discovery pass, follow package repositories and dependencies, add any newly exposed engine, and repeat until a complete pass introduces none.
5. Verify the inventory and navigation, run architecture validation and focused tests, then complete the required simplicity, specification, and quality reviews.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Scope clarification during execution: broad registry queries returned more than one thousand irrelevant apps, CLIs, server packages, and chart results. The approved practical-exhaustive boundary is now objective: official metadata must describe a reusable browser graph/diagram library or rendering foundation. Raw result counts and hashes keep the broader search auditable without treating unrelated software as renderer candidates.

Discovery correction: the first GitHub CLI attempt embedded language and license qualifiers inside one positional query string. Identical JavaScript and TypeScript sets plus Apache-licensed hits showed that this did not enforce the intended filters. The final inventory replaces those results with explicit --language and --license flags; the rejected hashes remain only in task history, not in the current implementation plan.

Review corrections: normalized all 209 rows to the seven approved categories; moved Vue Flow to its own framework-specific proof, moved chor-js under diagram-js, added @plantuml/core as a visible MIT static generator, and replaced install-only eligibility wording with the official renderer metadata plus clean-install evidence. Exact multiword GitHub command syntax and the package/repository dependency follow-up counts and hashes are now recorded.

Simplicity review: the first cold review found four incompatible table schemas. All candidate and exclusion groups now use one six-column schema; the single targeted re-review passed.

Verification: npm run validate:architecture passed for all five revisions; focused architecture-reader and validator tests passed 22/22; Comark parsed the Revision 04 README, selection experiment, and inventory; git diff --check passed. A full npm run check passed 106/107 but the unrelated existing source-refresh filesystem watcher test timed out twice waiting for an added-component refresh; TASK-17.4 does not modify that watcher or its test.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Completed a repeatable, source-backed inventory of 209 relevant browser graph and diagram projects. Every row now uses the approved classification schema and records identity, license, underlying renderer, and proof eligibility; React Flow, G6, MSAGL, and newly discovered engines remain unranked. Two discovery passes reached closure with recorded commands, counts, hashes, and dependency/repository follow-up evidence. Architecture validation, 22 focused tests, Comark parsing, diff checks, and cold simplicity/specification/quality reviews passed. The full suite remains 106/107 because an unrelated pre-existing source-refresh watcher test timed out twice; this task does not modify that flow.
<!-- SECTION:FINAL_SUMMARY:END -->
