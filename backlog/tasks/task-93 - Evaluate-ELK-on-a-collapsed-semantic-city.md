---
id: TASK-93
title: Evaluate ELK on a collapsed semantic city
status: Done
assignee:
  - grok
created_date: '2026-08-18 19:30'
updated_date: '2026-08-18 19:34'
labels: []
dependencies:
  - TASK-92
references:
  - src/semantic-layout.ts
documentation:
  - backlog/docs/doc-1 - Semantic-city-layout-evaluation.md
modified_files:
  - src/semantic-layout.ts
  - test-bun/semantic-layout.test.ts
priority: high
type: spike
ordinal: 98000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Codex asked whether ELK can produce a city from the semantic view without inheriting hidden children. Feed the collapsed items and promoted edges to ELK and measure two things: a Context system must stay name-sized instead of Terminal-viewer-tall, and Shop, its people, and sibling systems should keep their origins when Enter opens Containers. This task is the evaluation only. It does not replace world-layout, rewrite a renderer, or change architecture Markdown.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 ELK lays out the semantic view using collapsed sizes, not the nested world bounds
- [x] #2 At Context, a fixture system with a tall nested stack is no taller than its collapsed representation
- [x] #3 The evaluation records whether Shop, connected people, and sibling systems keep their origins across Enter to Containers
- [x] #4 A written report states the measurements and whether ELK can keep anchors without a second strategy
- [x] #5 Fixture tests run the layout pass; bun test of the new file passes
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
1. Add layoutSemanticView: ELK graph from the semantic items (collapsed sizes) and promoted edges; nest entered children under the focus; do not pass hidden-descendant bounds.
2. Add preserveSemanticAnchors: keep Context origins for items that already existed; lay out only new children inside the entered parent.
3. Measure both strategies on the tall Shop fixture and on viewer-view after the existing world-layout pass.
4. Tests assert the compact-size win and record origin deltas across Enter.
5. Write a Codex evaluation report with the numbers and a keep/pin recommendation.
6. bun test the new file; do not change TUI or web paint.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Two strategies. Fresh ELK on the semantic graph makes Context Shop 44×40 (world was 400 / viewer-view 234) but re-places roots on Enter: git +93, vault +205. preserveSemanticAnchors keeps Shop/Buyer/Git origins and packs new containers inside Shop; Shop grows to 164×96 / 234×180. ELK is useful for Context and for packing new children; it cannot keep anchors if asked to relayout the whole city. Pinned growth can overlap a nearby sibling (viewer-view Vault). bun test semantic-view + semantic-layout: 8 pass. tsc clean. Report: backlog doc-1 and ~/.codex/visualizations/2026/08/18/semantic-layout-eval/REPORT.md.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
ELK can lay out the collapsed semantic view so Context Shop is 44×40 instead of the nested 234–400 height. A fresh ELK pass on Enter moves people and jumps sibling systems. Pinning Context origins and packing only new children keeps anchors still. Report in backlog doc-1. Verified with bun test test-bun/semantic-layout.test.ts and test-bun/semantic-view.test.ts (8 pass) and bunx tsc --noEmit.
<!-- SECTION:FINAL_SUMMARY:END -->
