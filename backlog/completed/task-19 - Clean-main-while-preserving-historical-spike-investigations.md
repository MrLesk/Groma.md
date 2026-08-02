---
id: TASK-19
title: Clean main while preserving historical spike investigations
status: Done
assignee:
  - '@codex'
created_date: '2026-08-02 17:10'
updated_date: '2026-08-02 17:19'
labels: []
dependencies: []
references:
  - docs/superpowers/specs/2026-08-02-main-cleanup-design.md
modified_files:
  - README.md
  - docs/historical-investigations.md
  - docs/superpowers/plans/2026-08-02-main-cleanup.md
  - groma/plans/README.md
  - groma/plans/04-semantic-zoom-viewer
  - groma/plans/05-tui-viewer
  - backlog/completed
  - backlog/archive
priority: high
type: chore
ordinal: 39000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Leave concise, durable pointers to the semantic-zoom renderer-selection and OpenTUI spike branches; keep Revisions 04 and 05 as current product intent; and empty the active Backlog board without changing production source, tests, package manifests, temporary files, or spike artifacts in this pass.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 The root documentation links to one concise historical-investigations page naming both spike branches, exact commits, questions investigated, durable conclusions, and their never-merge status.
- [x] #2 Revisions 04 and 05 describe only current product intent, link to the historical investigations for evidence, and contain no known renderer contradiction.
- [x] #3 Terminal completed work is moved through the Backlog CLI to completed history, unfinished or superseded TASK-17 and TASK-18 work is archived, and the active Backlog task list is empty after this cleanup task itself is completed.
- [x] #4 Both historical branch refs and exact commits still resolve, architecture Markdown validates, and no production source, test, package-manifest, temporary, or spike-artifact path changes in this pass.
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
1. Record the approved cleanup boundary in a concise design specification and commit that specification alone.
2. Add one historical-investigations page and a small root README pointer; reduce Revisions 04 and 05 to current intent plus evidence pointers and correct the remaining renderer contradiction.
3. Through the Backlog CLI, move terminal work to completed history and unfinished or superseded TASK-17/TASK-18 work to archive, then finish and complete TASK-19 so the active board is empty.
4. Verify both spike refs and commits, validate architecture Markdown, confirm the active board is empty, and prove that no production source, test, package-manifest, temporary, or spike-artifact path changed.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Implementation: added one concise historical index, linked it from the root README, retained Revisions 04 and 05 as current intent, removed renderer-selection chronology from Revision 04, and aligned its React Flow and four-landmark wording. Backlog CLI moved every Done task to completed history and archived unfinished or superseded TASK-17/TASK-18 work plus milestone m-3.

Plan correction: the existing concise groma/plans/README.md index was included so the retained Revision 04 and 05 directories remain discoverable. The cold simplicity review also found Revision 04's canvas page still named only three landmarks; it now matches the approved four-level plan.

Cold simplicity review: the flow is README -> one historical index -> immutable branch snapshots, while current plans contain only current intent. One index is the smallest non-duplicative pointer; no additional abstraction, compatibility behavior, fallback, or test machinery is present. An unfamiliar reader can distinguish current plans, completed delivery, archived proposals, and historical evidence from their paths and opening paragraphs.

Specification and quality review: PASS. Both exact branch refs resolve, plan links resolve locally, Revision 04 and 05 contain no G6/RGUI renderer contradiction, architecture validation passes all 6 revisions (70 elements, 77 relationships), cached whitespace checks pass, and the excluded production/source/test/package/spike status is byte-identical to the baseline.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Documented both spike branches as historical never-merge investigations, retained concise current Revision 04/05 plans, moved terminal work to completed history, and archived superseded TASK-17/TASK-18 work. Verified exact refs, all six architecture revisions, cached diff scope, and unchanged excluded production/spike paths.
<!-- SECTION:FINAL_SUMMARY:END -->
