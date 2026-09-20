---
id: TASK-463.2
title: Compare revisions on the architecture map
status: Done
assignee:
  - '@codex'
created_date: '2026-09-20 15:05'
updated_date: '2026-09-20 22:36'
labels: []
dependencies:
  - TASK-463.1
references:
  - history-revisions
  - revision-control
  - map
  - map-highlights
  - data
  - web-server
  - render
  - scanner-source-watch
  - scanner-session
  - settings-control
  - web-page
  - source-control
modified_files:
  - src/history/comparison.ts
  - src/history/snapshots.ts
  - src/viewers/web/payload.ts
  - src/viewers/web/data.ts
  - src/viewers/web/map-session.ts
  - src/viewers/web/url.ts
  - src/viewers/web/atoms/theme.ts
  - src/viewers/web/revision/view.ts
  - src/viewers/web/revision/control.ts
  - src/viewers/web/iso/map.ts
  - src/viewers/web/iso/style.ts
  - src/viewers/web/render.ts
  - src/scanner/source-watch.ts
  - src/scanner/session.ts
  - test/fixtures/revision-comparison.json
  - test-bun/revision-comparison.test.ts
  - test-bun/web-revisions.test.ts
  - docs/viewers/web/index.md
  - groma/relationships.md
  - src/viewers/web/page.ts
  - src/viewers/web/source/control.ts
  - groma/systems/groma-md/containers/cli/components/history-revisions.md
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
- [x] #1 From viewed revision B, Compare from asks only for starting revision A, keeps B visible as context, and opens A to B after selection. Canceling preserves the current view.
- [x] #2 The comparison header shows clipped starting and destination messages separated by a non-interactive vs. label, with {commitId} - {commitMessage} hover titles. Messages are labels, not buttons for individual views. A direct × action ends comparison and leaves B open.
- [x] #3 The header dropdown shows full pair metadata and allows either endpoint to change through the same header filter pattern. Canceling an endpoint selection preserves the pair. Map, details, and source inspection receive the same selected pair.
- [x] #4 Both commit-to-commit and commit/working-tree comparison work. The working-tree side follows live changes, including source-only changes.
- [x] #5 The comparison applies the parent's stable-ID and change rules independently to components and relationships. The receipt-delivery example demonstrates Added, Modified, Removed, unchanged context, source-only modification, and relationship-only changes without endpoint modification.
- [x] #6 The combined map contains B plus removed components and relationships from A. Unchanged elements remain visible; removed components remain selectable. Former parent context needed to place removed components stays neutral.
- [x] #7 Only components and relationships receive change colors, using the parent palette and interaction/draft styling rules. Systems, containers, groups, and other context retain ordinary styling.
- [x] #8 Comparison data and UI follow the parent's task and flow rules. Component selection is kept or cleared according to the resulting view, including when comparison ends.
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
1. Derive component and relationship changes in a pure history comparison domain. Match component IDs; include neutral former ancestor context in B plus removed A elements. Keep both inputs immutable. Existing OKF metadata and C4 levels stay unchanged.
2. Load exact snapshot pairs at the web delivery boundary. Read the union of owned files in both roots so ownership changes are distinct from file changes. Compute one comparison consumed by map and later detail/source views.
3. Extend the existing header controller to own one ordinary revision or comparison pair; reuse its filter for endpoint selection and return to B on exit. Keep tasks and authoring only in ordinary live working-tree view.
4. Apply shared theme roles to component faces and relationships, preserving green interaction emphasis. Observe owned source edits even without a scanner.
Tests: parent identity/change rules require a fixture comparison covering stable-ID rename/move, added/removed components, relationship-only and flow-only changes, source-only changes, neutral context, and unchanged files after ownership removal. Existing tests have no revision comparison. Add focused pure comparison tests and extend the revision-session integration for pair reads and working-tree source events; use browser checks for header transitions and colors.
5. Run focused checks and browser flow, then the repository check and required simplicity/specification/quality/full-context reviews before finalizing.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Focused comparison, revision-session, and source-watch tests pass (4 tests, 34 assertions). The session integration confirms exact commit pairs, rejects identical endpoints, excludes tasks, and observes a working-tree source edit without a scanner. Component colors share semantic theme roles with diff lines; metadata remains derived, without any OKF/C4 storage changes.

The preview server's scanner updated the existing scanner-session → web-session relationship to include the new owned-file predicate. This task-scoped generated architecture change is included. Stopped that repository preview; remaining visual checks run against an isolated receipt-delivery fixture.

Cold simplicity review and its one targeted re-review pass after forwarding the pair to source inspection and removing duplicate destination extraction/layout. Implementer specification review traces every comparison transition and stable-ID/status rule to the parent; quality review confirms immutable input snapshots, one header authority, no new complexity warnings, and meaningful fixture assertions. Browser receipt example verified start-from with fixed destination, full metadata, endpoint cancellation, removed-component selection, exact retained source, and × returning to B while closing removed details. The remaining detail/diff presentation belongs to TASK-463.3.

Latest bun run check passed: 627 Bun tests, 36 skipped, no failures; lint, types and Node suite passed. The only complexity warning is pre-existing scanner-release coverage outside this task. Light, dark, and blueprint maps were inspected; fixed the legend selector so its status roles override the existing neutral legend style.

Full-context complexity review passes. Removed duplicate legend CSS it noticed. The live scanner created empty file-shaped Comparison and Snapshots records; the Groma CLI combined them into the existing Revision history component, which owns exact revision loading and derived comparisons. No new C4 boundary is needed.

Final browser check changed destination B to working tree and starting A to a different commit, preserving one pair and excluding authoring/tasks. Confirmed semantic legend colors after CSS cleanup. All required reviews pass; no blocking findings remain.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Added one derived comparison model, exact pair loading, a searchable A/B header with direct exit, and component/relationship change colors. Removed context remains selectable; owned working-tree files refresh through the existing watcher. Source reads receive the same pair. Verified by fixture and live-source tests, all three themes and header transitions in-browser, full repository check (627 passed), cold and full-context reviews.
<!-- SECTION:FINAL_SUMMARY:END -->
