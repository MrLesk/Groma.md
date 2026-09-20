---
id: TASK-370
title: Group scanner settings by project installation state
status: Done
assignee:
  - '@codex'
created_date: '2026-09-13 12:19'
updated_date: '2026-09-13 14:15'
labels: []
dependencies: []
references:
  - scanner-modules
  - terminal-viewer
  - web-viewer
modified_files:
  - src/scanner/modules/settings-model.ts
  - src/viewers/tui/scanner-settings.ts
  - src/viewers/web/scanners/settings.ts
  - test-bun/scanner-settings.test.ts
  - docs/scanners/setup.md
  - src/scanner/modules/settings.ts
type: enhancement
ordinal: 416000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
A flat scanner list mixes local packages, selections shared by colleagues, and recommendations. Long match-file lists obscure the next action. Keep terminal and web settings on one screen with existing scanner installation and compatibility rules.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Both settings surfaces show Installed first, Missing on this computer second, and Recommended last; empty groups are hidden.
- [x] #2 Missing selections and installable recommendations expose Install: restoring preserves a selection and installing a recommendation adds it to the project. Unsupported releases cannot be installed through a recommendation.
- [x] #3 Recommendations explain relevance briefly; full source paths, match files and diagnostics are shown only when details are requested inline.
- [x] #4 Search filters the grouped list on the same screen and long lists remain navigable with the selected scanner visible.
- [x] #5 Terminal and web interactions are exercised with installed, missing and recommended scanners, including filtering and installation state changes; repository checks pass.
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
Share pure grouping, filtering, match-summary and install-action decisions. Update terminal navigation and inline details, then the existing web dialog. Verify state transitions in tests and capture real terminal/web examples.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Review reproduced a grouping defect: an incompatible catalog recommendation changed a missing selection to blocked, making it appear installed. Keep package-missing status until the package exists; the existing scanner preparation still checks compatibility before running it.

Verification: bun run check passed (16 Node tests, 285 Bun tests, 6 existing native Rust/Go skips); git diff --check passed. Shared-state tests cover grouping, filtering, restore versus recommendation installation actions, and missing selections with incompatible catalog recommendations. Real tui-test sessions and the browser preview exercised all three groups, search, inline details, navigation through 34 scanners, missing-local-package Install guidance, and local scanner addition; the web also exercised removal and confirmed unavailable recommendation Install stays disabled after Check again. Screenshots: grouped-ui/terminal.png and grouped-ui/web.png in the thread visualization directory. Existing unpublished catalog releases were not published or changed. Specification and quality review completed: presentation uses the existing scanner session and action flow, introduces no architecture or storage concepts, keeps selection separate from local package availability, and keeps all changed source/test files below 500 lines. Setup documentation describes the final controls.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Terminal and web scanner settings now share Installed, Missing on this computer, and Recommended groups, same-screen search, short match reasons, and inline technical details. Missing selections and compatible recommendations expose Install. Verified real UI flows with 34 scanners and a passing full repository check (301 tests passed, 6 existing skips).
<!-- SECTION:FINAL_SUMMARY:END -->
