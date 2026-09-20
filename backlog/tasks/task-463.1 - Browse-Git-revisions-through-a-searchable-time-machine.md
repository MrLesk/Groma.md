---
id: TASK-463.1
title: Browse Git revisions through a searchable time machine
status: To Do
assignee: []
created_date: '2026-09-20 15:05'
labels: []
dependencies: []
references:
  - history-revisions
  - revision-control
  - data
documentation:
  - docs/viewers/web/index.md
parent_task_id: TASK-463
priority: high
type: feature
ordinal: 536000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Developers need to find a revision by commit ID or message, including source-only commits. The existing picker filters history to Groma Markdown and extracts and validates every historical architecture before returning its list; a local check of 127 entries took 41 ms for metadata and 2.65 s for the full loader. This child owns ordinary revision discovery and browsing. Shared requirements are in TASK-463.

## Supported scenarios

```gherkin
Feature: Browse architecture revisions
  Scenario: Find a source-only commit
    Given I am viewing the current working tree
    And a commit changed owned source without changing architecture Markdown
    When I open the header revision control and filter by its ID or message
    Then the commit appears without loading historical architecture for the list
    When I select it
    Then its architecture and sources open without comparison

  Scenario: Cancel revision search
    Given I am viewing a commit
    When I filter revisions and close the picker without selecting
    Then the same commit remains open and its header label is restored
```
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 The live viewer starts on the working tree. Its revision list includes current-branch commits with source-only changes, using Git commit metadata without restricting history to commits touching groma/.
- [ ] #2 Opening or searching the picker does not extract, parse, or validate every historical architecture. Architecture is loaded and checked when a revision is selected, and an unsupported selected revision is reported at selection.
- [ ] #3 Opening the header revision control turns that control into a filter input. Search matches full or abbreviated commit IDs and commit messages without case sensitivity; results appear directly below it with no second search field in the popup.
- [ ] #4 Selecting a result opens that revision without comparison. Closing without selection preserves the view and restores its label. The closed control shows a clipped commit message with hover title {commitId} - {commitMessage}; working-tree labels identify the working tree without inventing a commit ID.
- [ ] #5 The picker makes the commit identity, message, body, and date available. Selecting a revision reads architecture and source contents from that revision and preserves or clears component selection according to the parent rules, without changing the checkout.
- [ ] #6 The developer can return to the current working tree with ordinary tasks and flows intact. Each selected commit shows its own flows.
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [ ] #1 Acceptance criteria have objective verification evidence.
- [ ] #2 Relevant checks pass and changes remain task-scoped.
- [ ] #3 Public contracts or documentation are updated when behavior changes.
- [ ] #4 Implementation Plan reflects the final approach; correction history and verification are recorded in Implementation Notes.
<!-- DOD:END -->
