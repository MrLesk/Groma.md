---
id: TASK-463.3
title: Review component changes and source diffs
status: Done
assignee:
  - '@codex'
created_date: '2026-09-20 15:05'
updated_date: '2026-09-20 22:47'
labels: []
dependencies:
  - TASK-463.2
references:
  - organisms-details
  - source-control
  - task-diff-control
  - shell
  - history-revisions
  - screen
  - web-page
  - render
  - source-diff
modified_files:
  - src/viewers/source/diff-lines.ts
  - src/viewers/source/diff.ts
  - src/viewers/tui/panes/code.ts
  - src/viewers/tui/panes/details.ts
  - src/history/comparison.ts
  - test-bun/revision-comparison.test.ts
  - src/viewers/web/source/diff-view.ts
  - src/viewers/web/task-diff/view.ts
  - src/viewers/web/comparison/details.ts
  - src/viewers/web/organisms/details.ts
  - src/viewers/web/page.ts
  - src/viewers/web/chrome/shell.ts
  - src/viewers/web/render.ts
  - src/viewers/web/source/control.ts
  - src/viewers/web/source/view.ts
  - src/viewers/web/task-diff/control.ts
  - src/viewers/web/url.ts
  - test-bun/file-diff.test.ts
  - groma/relationships.md
  - groma/systems/groma-md/components/diff-view.md
  - groma/systems/groma-md/components/details.md
  - groma/systems/groma-md/containers/export/components/diff-view.md
  - groma/systems/groma-md/containers/export/components/source-control.md
  - groma/systems/groma-md/containers/export/components/details.md
  - groma/systems/groma-md/containers/export/components/organisms-details.md
  - docs/viewers/web/index.md
parent_task_id: TASK-463
priority: high
type: feature
ordinal: 538000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
After selecting a changed component, a developer needs to understand its responsibilities and implementation changes and inspect the supporting source. Existing task review already provides the useful file-list, expanded unified-diff, and Back interaction. The observed overlap between map controls and the expanded pane also affects ordinary panels. This child owns those details and source interactions; shared semantics and colors are in TASK-463.

## Supported scenario

```gherkin
Feature: Inspect comparison details
  Scenario: Review a changed file
    Given I selected Checkout in comparison A to B from the parent example
    When I open a modified file from How it is built
    Then I see its unified A-to-B diff in the expanded pane
    And the pane covers map controls within its area
    When I go Back
    Then the same component, tab, and scroll position are restored
```
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 What it does and How it is built explain added, modified, and removed component content. Added content comes from B; removed content is readable from A without striking through the whole description; modified content keeps unchanged context and exposes changed prose and fields.
- [x] #2 Relationship rows show their independent status. The file list contains relevant files from both revisions, including unchanged files, actual file-change statuses, and relevant addition/removal counts. Component removal or ownership changes do not falsely classify source files as deleted.
- [x] #3 Selecting a changed file opens the existing expanded details area with a unified diff, old/new line numbers, syntax highlighting, unchanged context, plus/minus markers, and change counts. Added files show complete new content, removed files complete old content, modified files changed hunks with context, and unchanged files use ordinary source view.
- [x] #4 File inspection uses the main time-machine pair, with no local revision picker. Back restores the same selected component, tab, and scroll position.
- [x] #5 Source-diff rendering is shared with ordinary live task diffs, while task review retains endpoint/file selection ownership. Relevant atomic components are grouped by domain and duplicate rendering paths are removed.
- [x] #6 Details and file diffs use the parent's color roles and comparison task-visibility rules.
- [x] #7 Shared side panels, including expanded source/diff panes, cover map controls within their occupied area. Verify both an ordinary panel and the comparison diff pane; the main header time machine remains usable.
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
1. Reuse the existing unified-diff projection and renderer under the source domain. Task review keeps its task metadata and file selection; comparisons supply the selected component and main header pair.
2. Extend comparison file facts with shared diff counts/hunks once, used by the file list and drill-down. Unchanged files use ordinary source reading; changed files use their actual A/B contents regardless of ownership changes.
3. Extend the existing details sections with comparison presentation: status label, before/after prose and fields, independent relationship statuses, and the union of files. Keep readable A content for removed components, B content for added components, unchanged context for modified ones, and no Tasks tab or second revision picker.
4. Raise the shared details dock above map controls while retaining the header above it. Preserve Back selection, tab, and scroll.
Tests: the accepted file behavior requires actual file existence/status, counts, old/new numbering and added/removed complete content; existing task diff projection tests cover most rules. Extend that coverage only for comparison ownership-vs-file status and use existing task/source controller tests to guard reuse. Verify all three component states/tabs and ordinary/comparison panel stacking in the browser.
5. Run focused checks, cold simplicity review, own specification/quality review, full-context review and repository check. Update web docs and task evidence.

Coverage correction after inspection: existing task folding tests cover navigation, but no direct unified-diff projection test was found. Add a small projection test for old/new line numbering and added/removed full content, and extend the comparison fixture assertions for file counts/status. These detect wrong ranges or ownership being mistaken for deletion; avoid CSS/prose assertions.

URL restoration uses the same A/B ownership union as the file list. Extend comparison coverage with a formerly owned file: opening/sharing it must preserve the file and How tab; ordinary B must reject it. Existing theme URL tests cover only theme state.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Comparison files now reuse the task diff projection and file renderer in the source domain. Shared status is removed consistently; task-specific Shared metadata stays in task review. Added meaningful projection coverage for line positions, context, and complete added/removed content. Existing terminal source/folding and web outline tests pass after import updates.

Quality inspection found that a comparison file formerly owned by the selected component must also survive URL restoration. Source selection now checks the same A/B file union as the URL and file list; ordinary source ownership is unchanged.

Cold simplicity review passed with no findings. Implementer specification/quality review traced header pair -> history file facts -> existing details tabs -> shared source diff -> Back. Browser verified added/modified/removed prose and How tabs, actual unchanged file under a removed component, changed file content/counts, Back, no task tab, and header operation. Source link ownership now uses the A/B union, with focused URL coverage. UI inspection also found generic legend CSS overriding comparison-only visibility; corrected selector specificity. TUI smoke renders the fixture via tui-test; existing source/folding tests verify unchanged task source behavior. Documentation explains the final owners and derived OKF/C4 semantics.

Final full-context complexity review passed with no material findings. Final repository check: 630 pass, 36 skip, 0 fail; only the pre-existing scanner-release complexity warning remains. Ordinary expanded-panel browser hit testing confirms it covers the overlapping map-view controls; the header stays above it. Comparison diff uses the same global dock. All acceptance criteria and Definition of Done reviewed against this evidence.
<!-- SECTION:NOTES:END -->
