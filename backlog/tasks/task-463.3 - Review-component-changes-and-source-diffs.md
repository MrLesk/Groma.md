---
id: TASK-463.3
title: Review component changes and source diffs
status: To Do
assignee: []
created_date: '2026-09-20 15:05'
labels: []
dependencies:
  - TASK-463.2
references:
  - organisms-details
  - source-control
  - task-diff-control
  - shell
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
- [ ] #1 What it does and How it is built explain added, modified, and removed component content. Added content comes from B; removed content is readable from A without striking through the whole description; modified content keeps unchanged context and exposes changed prose and fields.
- [ ] #2 Relationship rows show their independent status. The file list contains relevant files from both revisions, including unchanged files, actual file-change statuses, and relevant addition/removal counts. Component removal or ownership changes do not falsely classify source files as deleted.
- [ ] #3 Selecting a changed file opens the existing expanded details area with a unified diff, old/new line numbers, syntax highlighting, unchanged context, plus/minus markers, and change counts. Added files show complete new content, removed files complete old content, modified files changed hunks with context, and unchanged files use ordinary source view.
- [ ] #4 File inspection uses the main time-machine pair, with no local revision picker. Back restores the same selected component, tab, and scroll position.
- [ ] #5 Source-diff rendering is shared with ordinary live task diffs, while task review retains endpoint/file selection ownership. Relevant atomic components are grouped by domain and duplicate rendering paths are removed.
- [ ] #6 Details and file diffs use the parent's color roles and comparison task-visibility rules.
- [ ] #7 Shared side panels, including expanded source/diff panes, cover map controls within their occupied area. Verify both an ordinary panel and the comparison diff pane; the main header time machine remains usable.
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [ ] #1 Acceptance criteria have objective verification evidence.
- [ ] #2 Relevant checks pass and changes remain task-scoped.
- [ ] #3 Public contracts or documentation are updated when behavior changes.
- [ ] #4 Implementation Plan reflects the final approach; correction history and verification are recorded in Implementation Notes.
<!-- DOD:END -->
