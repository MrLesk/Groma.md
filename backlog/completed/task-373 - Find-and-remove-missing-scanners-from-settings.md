---
id: TASK-373
title: Find and remove missing scanners from settings
status: Done
assignee:
  - '@codex'
created_date: '2026-09-13 14:15'
updated_date: '2026-09-13 14:19'
labels: []
dependencies: []
references:
  - scanner-modules
  - web-viewer
modified_files:
  - src/scanner/modules/settings-model.ts
  - src/viewers/web/scanners/settings.ts
  - test-bun/scanner-settings.test.ts
type: bug
ordinal: 419000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
After opening a shared Groma project, a colleague may have configured scanner packages that are not present locally. Searching by their saved package name currently hides those selections, and Web does not offer removal until a package exists. Both actions must work without installing the missing package.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Searching terminal or web settings by a saved package source finds a missing scanner even when its scanner ID differs from the package name.
- [x] #2 Web offers Remove from project for a missing scanner, removes its selection without attempting installation, and preserves saved architecture.
- [x] #3 Focused regression tests, actual terminal and web flows, and bun run check pass.
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
Include the saved source in the existing shared scanner filter. Keep Install as the primary missing-scanner action and expose Remove in its existing Details area. Add a missing-package search regression and verify removal against a fixture project.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Implemented missing-source search in the shared filter and exposed missing-scanner removal in the existing Web Details actions. Five focused business tests passed. Real tui-test and browser sessions found scanner ID custom by its saved package source @team/code-scanner@1.0.0; browser removal cleared the selection while every fixture architecture Markdown file remained byte-identical. Full bun run check passed with 16 Node and 287 Bun tests, 6 existing native skips, and zero failures. The initial sandbox run blocked filesystem events and local test sockets; the permitted full run passed without code changes. git diff --check passed. Own specification and quality review found no remaining issue: removal reuses the existing session/configuration action, and search adds no new model fields. Cold targeted re-review passed search and task-reference corrections.

Full-context targeted re-review passed: static Export overview and Web missing-scanner removal are corrected, existing actions remain available without duplicate removal buttons, and no regression was found. Related record-only cleanup restored TASK-370/371 architecture references and TASK-357 export-overview traceability. The two stale smoke records remain unchanged pending a separate user decision because current Groma removal forbids scanned components.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Fixed package-source search for missing scanners and added Remove from project to their Web Details actions. Verified both real UIs and removal with unchanged saved architecture; all 303 tests passed with six existing native skips. Both targeted review agents passed the fixes.
<!-- SECTION:FINAL_SUMMARY:END -->
