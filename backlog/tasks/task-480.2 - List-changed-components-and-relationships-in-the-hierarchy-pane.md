---
id: TASK-480.2
title: List changed components and relationships in the hierarchy pane
status: Done
assignee:
  - '@codex'
created_date: '2026-09-21 21:25'
updated_date: '2026-09-26 15:57'
labels: []
dependencies:
  - TASK-480.1
references:
  - 'https://claude.ai/artifact/R5cB83CFiS9ZNN3qUoK2WG'
  - organisms-hierarchy
  - render
  - web-page
documentation:
  - docs/viewers/web/index.md
modified_files:
  - src/viewers/web/comparison/tree.ts
  - src/viewers/web/organisms/hierarchy.ts
  - src/viewers/web/render.ts
  - src/viewers/web/page.ts
  - test-bun/revision-comparison.test.ts
  - docs/viewers/web/index.md
parent_task_id: TASK-480
priority: high
type: feature
ordinal: 558000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
In a comparison the only way to find changes is to scan the map for tinted buildings. The hierarchy pane shows no status, collapsed containers hide their changed children, and containers kept only for removed components look identical to current ones, so "C# worker (4)" appears twice. Shared rules and frames: parent TASK and the design page.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 A comparison adds a Changes | All switch to the hierarchy pane title. Changes is the default. The switch is absent outside comparisons.
- [x] #2 Changes lists changed components under their container and system in tree order, then changed relationships as Source → Destination. Actors, flows and external systems are absent.
- [x] #3 A component row shows its name, the source lines added and removed when its owned source changed, and its status glyph in the status colour. A row without line counts changed only its record.
- [x] #4 Container and system rows show per-status counts of the changed components inside them. Slabs and islands stay neutral on the map.
- [x] #5 Removed components, and containers that exist only in the starting revision, have a muted name.
- [x] #6 All shows the ordinary tree with the same marks and counts.
- [x] #7 Selecting a row makes the same selection the hierarchy makes today: URL, camera and details follow. The current row is marked and scrolled into view.
- [x] #8 A comparison with no changes says so in the pane instead of showing an empty list.
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
1. Derive comparison tree rows and ancestor counts from existing component/relationship facts; reuse semantic tree ordering and hierarchy selection. 2. Add Changes/All switch, status marks, file totals and removed-context styling in the existing hierarchy. 3. Verify row filtering, ancestor counts, order and selection in a small fixture and real viewer. Test authority: AC 2-7; incorrect results include unchanged rows in Changes, lost changed descendants and wrong ancestor counts. Existing history tests prove comparison facts but not their hierarchy projection; add one focused projection test using existing fixtures.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Implemented the comparison hierarchy with existing semantic tree ordering and selection. Focused comparison tests: 5 pass; TypeScript and changed-file Biome lint pass. Browser fixture confirmed Changes default, ancestor counts, source totals, named relationships, All revealing unchanged Payment adapter, Checkout selection updating component URL/details and camera, and No changes for an empty pair. Full-theme/live integration and shared motion are verified with parent TASK-480 before final completion.

Parent TASK-480 integration is verified: live and static delivery, all three themes, small/empty comparisons, 1000 px layout, a single-snapshot export, 400 commits, reduced motion and live owned-source refresh. Final repository check passed (752 Bun tests, 16 Node tests; 48 skips; zero failures). Cold simplicity, implementer specification/quality and final full-context complexity reviews have no blocking findings.
<!-- SECTION:NOTES:END -->

## Comments

<!-- COMMENTS:BEGIN -->
author: @codex
created: 2026-09-26 15:37
---
TASK-529 overlap notice: I am fixing the reviewed inset URL regression. I will add only inset propagation inside syncUrl in src/viewers/web/render.ts and update url.ts plus focused tests. I will leave hierarchy/comparison changes and page.ts untouched; please preserve this small syncUrl hunk.
---
<!-- COMMENTS:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Comparison hierarchy now defaults to Changes, lists changed components under counted ancestors and changed relationships, and preserves ordinary selection. All restores the full tree. Verified with focused projection tests, TypeScript, Biome and browser checks for populated, empty and selected states. Parent TASK-480 owns final cross-surface integration checks and reviews.
<!-- SECTION:FINAL_SUMMARY:END -->
