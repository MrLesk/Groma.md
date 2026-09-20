---
id: TASK-463.1
title: Browse Git revisions through a searchable time machine
status: Done
assignee:
  - '@codex'
created_date: '2026-09-20 15:05'
updated_date: '2026-09-20 22:22'
labels: []
dependencies: []
references:
  - history-revisions
  - revision-control
  - data
  - web-server
  - render
  - web-page
documentation:
  - docs/viewers/web/index.md
modified_files:
  - src/history/revisions.ts
  - src/viewers/web/payload.ts
  - src/viewers/web/map-session.ts
  - src/viewers/web/revision/view.ts
  - src/viewers/web/revision/control.ts
  - src/viewers/web/render.ts
  - test-bun/web-revisions.test.ts
  - docs/viewers/web/index.md
  - src/viewers/web/page.ts
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
- [x] #1 The live viewer starts on the working tree. Its revision list includes current-branch commits with source-only changes, using Git commit metadata without restricting history to commits touching groma/.
- [x] #2 Opening or searching the picker does not extract, parse, or validate every historical architecture. Architecture is loaded and checked when a revision is selected, and an unsupported selected revision is reported at selection.
- [x] #3 Opening the header revision control turns that control into a filter input. Search matches full or abbreviated commit IDs and commit messages without case sensitivity; results appear directly below it with no second search field in the popup.
- [x] #4 Selecting a result opens that revision without comparison. Closing without selection preserves the view and restores its label. The closed control shows a clipped commit message with hover title {commitId} - {commitMessage}; working-tree labels identify the working tree without inventing a commit ID.
- [x] #5 The picker makes the commit identity, message, body, and date available. Selecting a revision reads architecture and source contents from that revision and preserves or clears component selection according to the parent rules, without changing the checkout.
- [x] #6 The developer can return to the current working tree with ordinary tasks and flows intact. Each selected commit shows its own flows.
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
1. Use Git metadata for web history, validating only the selected architecture; retain the terminal viewer's existing compatibility behavior.
2. Replace the web revision label with an in-place filter when open; keep revision presentation and controller together in the revision domain. Preserve component selection on successful navigation and show selection errors in the menu.
3. Extend product documentation and verify the supported browsing flow in the browser.
Tests: TASK-463.1 requires source-only commits, exact revision source reads, and unsupported revisions reported on selection. Existing startup tests do not cover Git history. Add one fixture-backed web-session test that commits two source versions plus an unsupported old architecture and checks discovery and exact source reads. Reuse existing selection coverage and manually verify filter/cancel/selection retention; do not add decorative tests.
4. Run focused tests and repository check, then cold simplicity review and implementer specification/quality review. Use the requested Grok 4.6 xhigh feedback after the completed feature, alongside the full-context review required by the repository.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Cold simplicity review found a reproduced terminal startup regression: unrestricted history made the terminal try archiving groma/ before that directory existed. Preserve the terminal's original path-filtered discovery while the web uses all commit metadata. Extend the existing new fixture scenario to call terminal history: it must exclude the pre-Groma commit and source-only commit, preventing this regression. Remove the unused workingTree presentation argument until static delivery uses it.

Verification: bun run check passed (625 Bun tests, 36 skipped, no failures; lint, types and Node suite passed). Focused revision and selection tests pass after strengthening the exact original-source assertion. Browser at 1440×900 verified message/ID filtering, Escape cancellation, exact commit navigation with selected component retained, and return to working tree with tasks restored. Header statistics no longer overlap a long revision label. Cold simplicity review corrected terminal history; implementer specification/quality and full-context complexity reviews found no remaining blocking finding. The optional controller naming note will be incorporated with comparison state in TASK-463.2.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Web history now loads commit metadata and filters in the header. Selecting a result loads exact architecture and source data while retaining valid selection; the terminal keeps its original history policy. Verified with the repository check, fixture integration test, selection tests, and browser navigation.
<!-- SECTION:FINAL_SUMMARY:END -->
