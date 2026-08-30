---
id: TASK-219
title: Separate Web Code and Files groups with subordinate dividers
status: Done
assignee:
  - '@codex'
created_date: '2026-08-30 16:40'
updated_date: '2026-08-30 16:57'
labels: []
dependencies: []
references:
  - source-viewer
modified_files:
  - src/viewers/web/source/view.ts
  - src/viewers/web/organisms/details.ts
ordinal: 232000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
When a developer reads How it is built in Web Details, Code and Files keep a clear hierarchy: each section heading owns the stronger boundary, while adjacent file groups share a lighter internal divider. The first group in each section has no leading divider, and existing Code and Files interactions remain unchanged.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Adjacent file groups in both Code and Files use one consistent internal separator, with no divider before either section's first group
- [x] #2 Internal file separators are visibly subordinate to the solid section-heading boundary in light and dark themes, so Code and Files remain clear section titles
- [x] #3 The shared treatment preserves Code hierarchy, Files evidence, and source-navigation behavior
- [x] #4 Focused checks and rendered browser validation confirm both multi-file sections
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
1. Mark the Code and Files outer lists as the same file-group visual domain without changing their semantic DOM or interactions. 2. Replace the Code-only solid divider rule with one shared adjacent-group rule whose line is a lighter mix of the theme hairline, while the existing section-heading line stays solid and stronger. 3. Run focused lint and TypeScript checks, repository checks, and rendered light/dark browser QA covering both sections and exact-line navigation.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Implemented one Source-domain CSS rule: adjacent Code file groups reuse var(--hairline) with 12px margin before and padding after, while the first group remains borderless. Focused Biome lint and TypeScript 7.1 checking pass. Rendered browser QA on a two-file component confirmed the exact computed border rule in light and dark themes, no framework overlay, no console warnings/errors, and unchanged exact-line navigation to src/helpers.ts:1. The repository-wide check reached all stages; 88/90 Node tests passed and the same two unrelated scan-watch cases failed from shared-machine EMFILE watcher exhaustion.

Cold simplicity, specification, and implementation-quality reviews passed with no findings. The final full-context architecture review recommends keeping the one-line adjacent-sibling rule unchanged: Source view owns Code-file presentation, the DOM owns group identity, CSS excludes the first group automatically, and the shared theme token owns divider color. It found no further code or concept to delete and judged the rule safe and easy for junior developers to understand.

Reopened from rendered feedback: the solid full-strength Code divider competed with the Code section-heading boundary, and Files needed the same grouping treatment. The correction makes section and inner-file boundaries different levels of the same visual system rather than adding another heading style.

Applied the rendered hierarchy correction with one shared file-groups class on Code and Files lists. Later groups use a 1px color-mix of the theme hairline at 60% opacity with the existing 12px spacing; section headings keep the solid full-strength hairline. Browser QA confirmed both lists have no first divider and the same lighter later divider in light and dark themes. Files opens src/helpers.ts at the top, Code opens helperEntry at line 1, and browser logs remain empty. Focused Biome, TypeScript 7.1, and diff checks pass. The repository check again reached all stages with 88/90 Node tests passing; only the same unrelated EMFILE scan-watch cases failed.

Cold simplicity review passed after removing the unused code-files class. Code and Files now use only the shared file-groups marker; focused checks pass and no code-files references remain. The targeted re-review found no regression.

Reopened specification and implementation-quality reviews passed with no findings. The final full-context architecture review kept the shared file-group rule and recommended deleting the unused per-item code-file class. That cleanup is applied; its targeted re-review and focused Biome, TypeScript 7.1, diff, and exact-token checks passed with no regression.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Gave Code and Files the same domain-owned file-group structure and a lighter shared internal divider, leaving each section heading as the stronger boundary. Removed obsolete styling hooks. Verified both multi-file sections in light and dark browser flows, file and exact-line source navigation, empty browser logs, focused lint/type/diff checks, and cold simplicity, specification, quality, and full-context architecture reviews; the full repository check remains limited only by the documented unrelated EMFILE watch-test failures.
<!-- SECTION:FINAL_SUMMARY:END -->
