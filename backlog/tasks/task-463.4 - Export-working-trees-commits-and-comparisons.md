---
id: TASK-463.4
title: 'Export working trees, commits, and comparisons'
status: To Do
assignee: []
created_date: '2026-09-20 15:05'
labels: []
dependencies:
  - TASK-463.3
references:
  - web-export
  - data
  - revision-control
  - source-control
parent_task_id: TASK-463
priority: high
type: feature
ordinal: 539000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
A CI job must be able to publish the same Groma experience so reviewers can inspect changes without a checkout or running Groma server. This child owns choosing export snapshots, packaging their required data, and documenting explicit CI usage. The parent TASK-463 owns the shared viewer, revision, task, and scope rules.

## Supported scenarios

```gherkin
Feature: Export Groma snapshots
  Scenario: Export one snapshot
    Given I choose the working tree or one specific commit for export
    When I open the static site
    Then it shows that snapshot's architecture and source contents
    And its header identifies that snapshot and offers no other revisions
    And no task data or task UI is present

  Scenario: Export a comparison
    Given I export commits A and B from the parent example
    When I open the static site without Git, Backlog, or a Groma server
    Then the same comparison map, details, and source diffs are available
    When I end comparison
    Then normal revision browsing offers only A and B
    And no task data or task UI is present
```
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 Working-tree export preserves current architecture and sources, including relevant uncommitted changes, as one fixed snapshot. Its time-machine control identifies the working tree and explains that no other revisions are available.
- [ ] #2 Exporting one specified commit includes that commit's architecture and sources regardless of the checkout, opens on that commit, and exposes its message, body, and ID. Its time-machine control explains that no other revisions are available.
- [ ] #3 Comparison export bundles exactly the two requested commits and the architecture/source data needed for comparison and individual inspection. It opens in the same A-to-B comparison as live Groma.
- [ ] #4 Ending comparison leaves B open. Ordinary revision selection offers only the two bundled commits; the developer can inspect either and start comparison again. No live working tree or unbundled revisions are offered.
- [ ] #5 Generated data supports the same map, details, source views, and file diffs without runtime Git, Backlog, or a Groma server. Export does not contain a separate comparison algorithm or presentation.
- [ ] #6 Every static export excludes task data and UI according to the parent rules, while ordinary live working-tree task behavior remains intact.
- [ ] #7 Initial comparison export accepts two commits. Document concrete CI usage with explicit starting and destination commits within the parent's scope limits.
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [ ] #1 Acceptance criteria have objective verification evidence.
- [ ] #2 Relevant checks pass and changes remain task-scoped.
- [ ] #3 Public contracts or documentation are updated when behavior changes.
- [ ] #4 Implementation Plan reflects the final approach; correction history and verification are recorded in Implementation Notes.
<!-- DOD:END -->
