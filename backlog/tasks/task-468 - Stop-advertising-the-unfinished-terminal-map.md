---
id: TASK-468
title: Stop advertising the unfinished terminal map
status: Done
assignee:
  - codex
created_date: '2026-09-20 18:19'
updated_date: '2026-09-20 18:23'
labels: []
dependencies: []
references:
  - src-welcome
  - src-cli
  - instructions
modified_files:
  - README.md
  - src/welcome/model.ts
  - src/cli.ts
  - src/instructions.ts
type: chore
ordinal: 544000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Remove promotion of the interactive terminal map from the README and welcome splash screen until it is ready. Keep the direct groma view command and plain or targeted architecture inspection available. Preserve unrelated pending documentation, icon, architecture, and web changes.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 The README no longer recommends the interactive terminal map or displays its feature bullet and screenshot.
- [x] #2 Interactive and plain welcome screens do not offer the terminal map, including the overview guide reachable from the welcome screen.
- [x] #3 The direct groma view command and plain or targeted inspection remain available; remaining welcome actions still work.
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
Remove the terminal-map action from the existing welcome action list and its unreachable dispatcher case. Remove the README promotion and the matching sentence in the shared human overview guide. Do not change the terminal map implementation or add another visibility setting. Coverage: this is a promotional removal, so use manual plain and interactive welcome checks and existing plain-view tests; do not add prose or source-text assertions. Run bun run check, perform specification and quality reviews, and request one final full-context complexity review. Stage only task-owned changes, including only the removal hunks in the already modified README, then commit and push.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Removed the terminal-map entry from the shared welcome action list, its now-unreachable welcome dispatcher case, the README quick-start example, feature bullet and screenshot, and the matching promotion in the overview shown inside the welcome screen. Plain and targeted inspection guidance and the direct view command are preserved. No new settings, abstractions, dependencies or tests were needed.

Verification: bun run check passed (16 Node tests; 622 Bun tests passed, 36 skipped, 0 failed; Bun suite 62.51 seconds). Checked the actual plain welcome, direct view --help, and tui-test sessions at 120x36 and 140x60. The welcome lists web, scan, Scanners, Instructions and Advanced; keyboard navigation opens Instructions and Advanced and returns to the launcher. The rendered overview describes only plain/targeted view usage. Screenshots: /tmp/groma-task468-welcome.svg and /tmp/groma-task468-overview.svg.

Implementer specification and quality reviews passed: the requested surfaces no longer advertise the terminal map; welcome row positions and the action type are derived from the same list, and the separate direct command remains intact. The flow stays in the existing welcome, command interface and command guides domains. The README working copy matches exactly the requested removals applied over its pre-existing icon edits; those icons will not be staged. This is a presentation-only change and does not change OKF records, C4 semantics or scanner behavior.

Final full-context complexity review passed with no blockers or recommended refactor. The shared action list, derived action type and exhaustive dispatcher remain the smallest clear design. Non-blocking scope observation: initialization still offers Open in terminal and CLI help describes the map; those separate entry points were not included in the requested README and splash changes. Protected documentation and architecture edits were verified unchanged (11 of 11 snapshot hashes).
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Removed interactive terminal-map promotion from the README, welcome actions and welcome overview while preserving the direct command and plain/targeted inspection. Verified with bun run check (16 Node and 622 Bun tests passed, 36 skipped), plain CLI output, and actual tui-test welcome/navigation checks. Specification, quality and full-context complexity reviews passed. Unrelated pending edits are preserved and excluded from the task commit.
<!-- SECTION:FINAL_SUMMARY:END -->
