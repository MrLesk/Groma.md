---
id: TASK-468
title: Stop advertising the unfinished terminal map
status: Done
assignee:
  - codex
created_date: '2026-09-20 18:19'
updated_date: '2026-09-20 19:09'
labels: []
dependencies: []
references:
  - src-welcome
  - src-cli
  - instructions
  - src-initialize
modified_files:
  - README.md
  - src/welcome/model.ts
  - src/cli.ts
  - src/instructions.ts
  - src/init-command.ts
  - src/init-command-ui.ts
type: chore
ordinal: 544000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Stop promoting the unfinished interactive terminal map in the README, welcome splash and initialization wizard. The user extended the original README and splash request to the init offer. Keep the direct groma view command and plain or targeted architecture inspection available. Preserve unrelated pending work.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 The README no longer recommends the interactive terminal map or displays its feature bullet and screenshot.
- [x] #2 Interactive and plain welcome screens do not offer the terminal map, including the overview guide reachable from the welcome screen.
- [x] #3 The direct groma view command and plain or targeted inspection remain available; remaining welcome actions still work.
- [x] #4 Initialization offers only opening the browser map or finishing setup, and its later-use reminder recommends only groma web.
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
The README and welcome promotion removals are already committed. For the approved init extension, replace the obsolete multi-viewer choice with the existing yes/no prompt for opening the browser map, remove the terminal reminder, and give setup one direct browser-opening callback. Keep direct terminal-map use intact. Coverage: this is a small onboarding removal with no existing init-command test coverage. Use actual tui-test setup flows in temporary projects for opening the browser callback and declining it, plus the existing full repository checks; add no copy or source-text tests. Perform implementer specification and quality reviews and one final full-context complexity review. Commit and push only the setup changes and this task record.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Removed the terminal-map entry from the shared welcome action list, its now-unreachable welcome dispatcher case, the README quick-start example, feature bullet and screenshot, and the matching promotion in the overview shown inside the welcome screen. Plain and targeted inspection guidance and the direct view command are preserved. No new settings, abstractions, dependencies or tests were needed.

Verification: bun run check passed (16 Node tests; 622 Bun tests passed, 36 skipped, 0 failed; Bun suite 62.51 seconds). Checked the actual plain welcome, direct view --help, and tui-test sessions at 120x36 and 140x60. The welcome lists web, scan, Scanners, Instructions and Advanced; keyboard navigation opens Instructions and Advanced and returns to the launcher. The rendered overview describes only plain/targeted view usage. Screenshots: /tmp/groma-task468-welcome.svg and /tmp/groma-task468-overview.svg.

Implementer specification and quality reviews passed: the requested surfaces no longer advertise the terminal map; welcome row positions and the action type are derived from the same list, and the separate direct command remains intact. The flow stays in the existing welcome, command interface and command guides domains. The README working copy matches exactly the requested removals applied over its pre-existing icon edits; those icons will not be staged. This is a presentation-only change and does not change OKF records, C4 semantics or scanner behavior.

Final full-context complexity review passed with no blockers or recommended refactor. The shared action list, derived action type and exhaustive dispatcher remain the smallest clear design. Non-blocking scope observation: initialization still offers Open in terminal and CLI help describes the map; those separate entry points were not included in the requested README and splash changes. Protected documentation and architecture edits were verified unchanged (11 of 11 snapshot hashes).

User approved removing the terminal-map offer from initialization as well. Reopened this same task for that code change; previous README/splash verification still applies. No active task overlaps src/init-command.ts, src/init-command-ui.ts or src/cli.ts.

The init extension uses the existing confirmation prompt and a browser-only callback. Removed the old viewer union, terminal choice, terminal reminder and CLI terminal dispatch. The terminal CLI helper no longer needs its scan argument because setup was the only caller that skipped its scan; direct use still scans through the existing viewer default.

Interactive verification in temporary initialized projects used the real setup UI and first-scan flow. Selecting No in the actual CLI completed setup without launching a viewer; its final reminder contained only groma web. Selecting Yes through runInitCommand invoked the injected browser callback exactly once and returned completed. Direct groma view still rendered the terminal map and exited with Ctrl+C after the CLI helper cleanup. Captures: /tmp/groma-task468-init-782jhbz0/prompt.svg, finished.svg and direct-view.svg. No live repository architecture was scanned or changed.

Final full repository check after all code changes passed: 16 Node tests; 622 Bun tests passed, 36 skipped, zero failures (54.09 seconds), plus lint and typecheck. Implementer specification review confirms the approved init extension: only browser opening is offered and recommended, declining it completes setup, and direct terminal access remains available. Quality review traced init through its existing UI, first-scan orchestration and CLI callback: one boolean answer and one browser action replace the unused multi-viewer contract. The implementation deletes more code than it adds, introduces no new module or dependency, and leaves OKF/C4 meaning unchanged. No blocking finding remains; final full-context review follows.

The final full-context review of the init extension passed with no blockers or recommended refactor. It confirmed that a boolean browser offer and direct callback are simpler than retaining a one-viewer selector, responsibilities stay in the existing setup UI/orchestration/CLI domains, and the narrower types prevent setup from requesting the terminal map. The direct command retains its existing scanning behavior. The 11 protected documentation/architecture files still match their earlier hashes.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Removed interactive terminal-map promotion from the README, welcome screen and initialization wizard. Setup now offers only the browser map and recommends groma web for later use; the direct groma view command and plain/targeted inspection remain available. The init extension passed real interactive Yes/No checks, direct terminal-map launch/exit, implementer and full-context reviews, and bun run check (16 Node and 622 Bun tests passed, 36 skipped). Unrelated pending work is preserved and excluded from the task commits.
<!-- SECTION:FINAL_SUMMARY:END -->
