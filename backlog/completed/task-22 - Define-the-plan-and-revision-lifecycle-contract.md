---
id: TASK-22
title: Define the plan and revision lifecycle contract
status: Done
assignee:
  - '@codex'
created_date: '2026-08-02 19:39'
updated_date: '2026-08-02 19:42'
labels: []
dependencies: []
references:
  - docs/superpowers/specs/2026-08-02-plan-revision-lifecycle-design.md
modified_files:
  - docs/superpowers/specs/2026-08-02-plan-revision-lifecycle-design.md
type: docs
ordinal: 2000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Record the human-approved Groma model in which plans are independent feature scopes, implemented architecture materializes into observed Markdown, and Git commits are immutable revisions. This task documents the contract only; migration and product implementation remain separate work after human review.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 The design defines Plan, Observed architecture, and Revision without treating plans as cumulative revisions
- [x] #2 The design explains how architecture Markdown moves from a plan into observed across one or more Git commits
- [x] #3 The design keeps the plan README until completion, excludes it from observed, and relies on Git history instead of a completed-plan archive
- [x] #4 The design explicitly separates this contract from migration and implementation work
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
1. Write the approved lifecycle and glossary as a focused design document.
2. Self-review the document for ambiguity, contradictions, placeholders, and scope expansion.
3. Commit only the design document and its Backlog record, then request human review before implementation planning.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Recorded only the approved design contract; no glossary, plan directories, loader, validator, comparison, or viewer behavior changed. Self-review found no placeholders, contradictions, or scope expansion. Cold simplicity review requested removal of an unnecessary stable-ID reference; it was removed, completion exclusions were collapsed, and the targeted re-review passed. `git diff --check` passed and the contract-marker check found all seven required sections/claims with zero placeholders.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Documented the approved Git-native lifecycle: independent partial plans materialize architecture Markdown into observed across commit revisions; the plan README remains until completion, then the plan disappears and Git retains its history. Verified by scope inspection, automated document checks, and a passing cold simplicity review.
<!-- SECTION:FINAL_SUMMARY:END -->
