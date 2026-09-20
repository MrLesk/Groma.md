---
id: TASK-381
title: Unify scanner status and duplicate findings in Project review
status: Done
assignee:
  - '@codex'
created_date: '2026-09-13 18:04'
updated_date: '2026-09-13 18:17'
labels: []
dependencies: []
references:
  - render
  - scanners-settings
  - page
modified_files:
  - src/viewers/web/review/model.ts
  - src/viewers/web/duplicates/control.ts
  - src/viewers/web/duplicates/view.ts
  - src/viewers/web/scanners/settings.ts
  - src/viewers/web/review/control.ts
  - src/viewers/web/page.ts
  - src/viewers/web/render.ts
  - test-bun/project-review.test.ts
  - docs/scanners/setup.md
  - docs/viewers/web/index.md
  - docs/architecture-findings.md
type: enhancement
ordinal: 427000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
TASK-377 already adds a warning button in the web header and a project-wide duplicate review. Scanner issues currently use a separate header button, warning bar and modal; long compiler diagnostics repeat in the bar, modal and table. Reuse the TASK-377 header button as one Project review entry, preserving its duplicate analysis while bringing scanner management into the same popup.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 The existing TASK-377 header warning button opens one Project review popup with Scanners and Potential duplicates tabs; separate scanner header and warning-bar surfaces are removed.
- [x] #2 Scanner groups and install, restore, update, remove and retry actions remain available in compact rows; failed scanners show concise status with full diagnostics once in expandable details.
- [x] #3 Duplicate filters, group counts, source comparisons and source/map navigation remain usable; closing or switching tabs preserves map selection and invalidates stale source reads.
- [x] #4 The shared header indicator reflects scanner attention and duplicate findings; first opening favors blocked scanning, otherwise duplicate findings, and live updates preserve the active tab.
- [x] #5 Static exports retain duplicate review without scanner operations; keyboard dismissal, focus, themes and browser verification work, and the full repository check passes.
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
1. Give the existing header warning button a shared Project review dialog with fixed tabs and content hosts. 2. Adapt the existing duplicate control and scanner settings to those hosts, retaining domain logic and lifecycle. 3. Replace verbose scanner rows with concise states and one diagnostic disclosure. 4. Verify state rules with focused tests, exercise both tabs and scanner actions in the browser, update documentation and run the full repository check.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Browser checks confirmed real no-scanner navigation and the isolated failed/missing/recommended fixture. Self-review preserved the no-matching-files label for installed scanners, restored focus after actions, and hid whole-group install actions while search narrows the displayed group so a filtered list cannot suggest it installs only visible matches.

The required cold simplicity review and final full-context complexity review both passed with no material findings. Implementer specification and quality reviews passed. Full bun run check passed: 16 Node tests, 305 Bun tests, 6 optional native skips; log /tmp/groma-380-381-check.log. Focused review-state and duplicate-lifecycle tests passed. All changed source/test files are under 500 lines and lint reports no added complexity warning; git diff --check passed.

Browser verification used the real isolated Groma clone with no scanner selections and an isolated UI fixture based on test/fixtures/flows for scanner action responses and duplicate source evidence. The clone retains its map and selection, opens Scanners first, switches tabs with arrow keys and dismisses with Escape back to the same header control. The fixture verified one expandable diagnostic, retry, restore, install, explicit update, removal and third-party addition; live responses keep the selected tab. Final focus correction verified after rebuilding the fixture: retry returns to Search, install/update/remove retain an actionable row control. Search hides whole-group install buttons. Duplicate comparison renders source differences and Open source navigates to the selected owner, exact file and line. Static delivery exposes only the duplicate tab and no scanner operations. Light and dark themes were inspected. No real packages were installed by these UI checks.

Screenshots: /tmp/groma-project-review-scanners.png (real clone), /tmp/groma-project-review-duplicates.png (UI fixture), /tmp/groma-project-review-error-light.png (UI fixture). The current release workflow changes from TASK-379 remain separate and uncommitted. No release published.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Reused TASK-377 header warning button for Project review with Scanners and Potential duplicates tabs. Removed separate scanner header/button, warning bar and modal; retained scanner operations and duplicate source navigation. Compact rows show concise failure status and full diagnostics once. Verified real no-scanner navigation, isolated action/failure and duplicate flows, static delivery, keyboard focus, themes, both required reviews and the full repository check.
<!-- SECTION:FINAL_SUMMARY:END -->
