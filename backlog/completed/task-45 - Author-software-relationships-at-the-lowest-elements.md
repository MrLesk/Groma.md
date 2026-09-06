---
id: TASK-45
title: Author software relationships at the lowest elements
status: Done
assignee:
  - '@grok'
created_date: '2026-08-16 16:04'
updated_date: '2026-08-16 16:09'
labels: []
dependencies:
  - TASK-44
references:
  - docs/product-model.md
  - groma/README.md
  - docs/viewers/index.md
  - src/viewers/relationship-text.ts
  - src/viewers/tui/projection.ts
priority: high
type: feature
ordinal: 49000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Software-to-software relationships are authored on the lowest elements that exist. Parents are connected because a child is. Do not also write the same collaboration on a parent.

In this repository, drop the duplicate rows Core → Web viewer, Core → Terminal viewer, and Groma → Git. Keep the child rows (World layout → Web map / Map, Architecture workspace → Git). Viewers treat an authored A → B as also connecting exclusive ancestors of A and B. Layout still has one edge per authored relationship. Route text appears when the selection is an endpoint or an exclusive ancestor.

People → system and container rows that have no lower pin stay as written.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Observed Markdown no longer repeats a child collaboration on Core → Web viewer, Core → Terminal viewer, or Groma → Git
- [x] #2 Selecting Web viewer or Core still presents the World layout → Web map relationship; selecting Groma does not treat that net as Groma to itself
- [x] #3 The TUI Containers view still shows a route between Core and Web viewer from the authored component relationship
- [x] #4 Product model, Markdown contract, and viewer docs state the authoring and promotion rule
- [x] #5 Tests cover exclusive-ancestor promotion; bun run check passes
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
1. Document the rule in product-model.md, groma/README.md, and the viewer pages.
2. Remove the three duplicate relationship rows from observed Markdown.
3. Extend showsRelationshipText with exclusive-ancestor promotion; add promotedPeer for details.
4. TUI: show a component-authored relationship at Containers/Context after promoting endpoints; details lists inherited nets with the matching ancestor as the peer.
5. Web details and route labels use the same function. One ELK edge per authored row, unchanged.
6. Tests for the gate; bun run check; browser-check one web selection.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Deleted Core → Web viewer, Core → Terminal viewer, and Groma → Git. Viewers promote exclusive ancestors: Web viewer details show ← Core · Supplies fixed positions and routes; Web map shows ← World layout; Groma shows workspace → Git as → Git and does not claim the layout net. TUI Containers projects world-layout → web-map as Core → Web viewer. Tests: relationship-text promotion; terminal-viewer containers promote. bun run check: 16 observed elements, 9 relationships; 63 node + 34 bun. Browser on this repo: one line to Web map; click Web viewer inherits the child net.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Software relationships are authored at the lowest elements. This repo dropped the three parent duplicates. Viewers promote exclusive ancestors so Core and Web viewer still show the World layout → Web map net, and the city has one route. Documented in the product model, Markdown contract, and viewer pages. Verified with bun run check and a browser selection of Web viewer.
<!-- SECTION:FINAL_SUMMARY:END -->
