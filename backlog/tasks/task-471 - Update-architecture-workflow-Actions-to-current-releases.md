---
id: TASK-471
title: Update architecture workflow Actions to current releases
status: Done
assignee:
  - codex
created_date: '2026-09-20 19:42'
updated_date: '2026-09-20 19:44'
labels: []
dependencies: []
modified_files:
  - .github/workflows/architecture.yml
type: chore
ordinal: 547000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Update the five GitHub Action references in the architecture publishing workflow to their latest stable upstream releases, as requested before Groma v0.4.0.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 All five Action references use the latest stable release tags verified from their upstream GitHub releases.
- [x] #2 The existing architecture build and deployment configuration stays intact and the updated workflow passes relevant checks.
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
Update only the five uses references to exact stable tags. Confirm action inputs and workflow syntax, run the repository check, review the small diff, then commit and push the workflow and task record. No new tests are needed for dependency pin replacements.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Verified the latest stable release for each of the five Actions through its upstream GitHub releases API. Updated only the uses references to checkout v7.0.1, setup-bun v2.2.0, configure-pages v6.0.0, upload-pages-artifact v5.0.0, and deploy-pages v5.0.1. Bun parsed the workflow YAML successfully. A metadata check against each tagged action.yml confirmed the existing inputs and consumed outputs; a parsed comparison confirmed every other workflow setting is unchanged. git diff --check passed. bun run check passed, including 623 Bun tests with 36 skips and no failures. Specification review: both acceptance criteria are satisfied. Quality review: the workflow remains the single owner of build and Pages deployment; only five version references changed, with no new concepts, tests, or public behavior. No documentation change is needed.

The Node suite also passed all 16 tests. Existing unrelated lint notices remain unchanged. The final full-context complexity reviewer found no blockers: the existing workflow remains the clearest owner, exact release tags make the update explicit, and no new abstraction or cleanup is needed.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Updated all five Actions in the architecture publishing workflow to their current stable release tags. Confirmed tagged action inputs and consumed outputs, valid YAML, unchanged build and deployment settings, and passing repository checks (16 Node tests and 623 Bun tests; 36 skips). Self-review and final full-context review found no blockers.
<!-- SECTION:FINAL_SUMMARY:END -->
