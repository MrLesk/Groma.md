---
id: TASK-219
title: Separate Web Code files with light dividers
status: Done
assignee:
  - '@codex'
created_date: '2026-08-30 16:40'
updated_date: '2026-08-30 16:47'
labels: []
dependencies: []
references:
  - source-viewer
modified_files:
  - src/viewers/web/source/view.ts
ordinal: 232000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
When a developer reads Code in Web Details, a light horizontal divider separates adjacent file groups so boundaries remain clear in long lists. The first group has no leading divider, and the existing declaration, class-member, and source-navigation structure remains unchanged.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Adjacent Code file groups are separated by one subtle theme hairline, with no divider before the first file
- [x] #2 The divider reuses the existing Details visual system without changing Code hierarchy or interaction
- [x] #3 Focused checks and rendered browser validation confirm the multi-file Code list
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
1. Extend the existing adjacent Code-file CSS rule in the Source viewer domain with the shared theme hairline. Split the vertical separation into margin before and padding after the divider so it sits between file groups; keep the first file untouched. 2. Run focused lint and repository checks, then validate a multi-file Code list in the rendered Web viewer. Add no DOM, behavior, documentation, or decorative unit-test changes.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Implemented one Source-domain CSS rule: adjacent Code file groups reuse var(--hairline) with 12px margin before and padding after, while the first group remains borderless. Focused Biome lint and TypeScript 7.1 checking pass. Rendered browser QA on a two-file component confirmed the exact computed border rule in light and dark themes, no framework overlay, no console warnings/errors, and unchanged exact-line navigation to src/helpers.ts:1. The repository-wide check reached all stages; 88/90 Node tests passed and the same two unrelated scan-watch cases failed from shared-machine EMFILE watcher exhaustion.

Cold simplicity, specification, and implementation-quality reviews passed with no findings. The final full-context architecture review recommends keeping the one-line adjacent-sibling rule unchanged: Source view owns Code-file presentation, the DOM owns group identity, CSS excludes the first group automatically, and the shared theme token owns divider color. It found no further code or concept to delete and judged the rule safe and easy for junior developers to understand.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Separated adjacent Web Code file groups with the existing theme hairline and balanced 12px spacing, leaving the first file and all Code interactions unchanged. Verified with focused Biome and TypeScript checks, computed-style and screenshot QA in light and dark themes, exact-line navigation, empty browser warning/error logs, and simplicity/specification/quality/architecture reviews; the full repository check's only failures were the unrelated shared-machine EMFILE scan-watch cases.
<!-- SECTION:FINAL_SUMMARY:END -->
