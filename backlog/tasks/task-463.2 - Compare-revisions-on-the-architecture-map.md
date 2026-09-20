---
id: TASK-463.2
title: Compare revisions on the architecture map
status: To Do
assignee: []
created_date: '2026-09-20 15:05'
labels: []
dependencies:
  - TASK-463.1
references:
  - history-revisions
  - revision-control
  - map
  - map-highlights
  - data
parent_task_id: TASK-463
priority: high
type: feature
ordinal: 537000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
A PR reviewer needs architecture and source changes in the normal map context, including removed components. This child owns comparison selection and the combined map. The shared identity, change, color, task, and flow rules and receipt-delivery example are defined in TASK-463.

## Supported scenarios

```gherkin
Feature: Compare revisions
  Scenario: Compare receipt delivery
    Given I am viewing B from the parent example
    When I choose Compare from and select A
    Then Checkout is Modified, Receipt worker is Added, and Receipt sender is Removed
    And Payment adapter remains visible without a change color
    And removed components remain selectable

  Scenario: Recognize a source-only change
    Given a component's Markdown is unchanged but its owned source changed
    When I compare those revisions
    Then that component is Modified

  Scenario: Recognize a relationship-only change
    Given only a relationship changed between two components
    When I compare those revisions
    Then the relationship shows its change
    And neither endpoint is Modified for that reason

  Scenario: Inspect an individual revision after comparison
    Given I am comparing A to B
    When I end comparison from the header
    Then B is shown without comparison
    When I select A through normal revision browsing
    Then A is shown without a retained comparison mode
    And the selected component is retained only if it exists in A

  Scenario: Follow working-tree changes
    Given one endpoint is the working tree
    When its owned source changes without an architecture Markdown edit
    Then the comparison updates to reflect that source change
```
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 From viewed revision B, Compare from asks only for starting revision A, keeps B visible as context, and opens A to B after selection. Canceling preserves the current view.
- [ ] #2 The comparison header shows clipped starting and destination messages separated by a non-interactive vs. label, with {commitId} - {commitMessage} hover titles. Messages are labels, not buttons for individual views. A direct × action ends comparison and leaves B open.
- [ ] #3 The header dropdown shows full pair metadata and allows either endpoint to change through the same header filter pattern. Canceling an endpoint selection preserves the pair. Map, details, and source inspection receive the same selected pair.
- [ ] #4 Both commit-to-commit and commit/working-tree comparison work. The working-tree side follows live changes, including source-only changes.
- [ ] #5 The comparison applies the parent's stable-ID and change rules independently to components and relationships. The receipt-delivery example demonstrates Added, Modified, Removed, unchanged context, source-only modification, and relationship-only changes without endpoint modification.
- [ ] #6 The combined map contains B plus removed components and relationships from A. Unchanged elements remain visible; removed components remain selectable. Former parent context needed to place removed components stays neutral.
- [ ] #7 Only components and relationships receive change colors, using the parent palette and interaction/draft styling rules. Systems, containers, groups, and other context retain ordinary styling.
- [ ] #8 Comparison data and UI follow the parent's task and flow rules. Component selection is kept or cleared according to the resulting view, including when comparison ends.
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [ ] #1 Acceptance criteria have objective verification evidence.
- [ ] #2 Relevant checks pass and changes remain task-scoped.
- [ ] #3 Public contracts or documentation are updated when behavior changes.
- [ ] #4 Implementation Plan reflects the final approach; correction history and verification are recorded in Implementation Notes.
<!-- DOD:END -->
