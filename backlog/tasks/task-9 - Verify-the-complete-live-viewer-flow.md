---
id: TASK-9
title: Verify the complete live-viewer flow
status: Done
assignee:
  - '@codex'
created_date: '2026-07-27 20:55'
updated_date: '2026-07-28 00:09'
labels: []
milestone: m-1
dependencies:
  - TASK-7
  - TASK-8
references:
  - README.md
  - groma/plans/02-live-viewer/README.md
  - 'https://c4model.com/'
  - 'https://github.com/comarkdown/comark'
modified_files:
  - README.md
  - package.json
  - e2e/release-gate.spec.js
priority: high
type: task
ordinal: 9000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Revision 02 is the release gate for the complete Markdown-to-view workflow. Using the observed snapshot from Revision 01 and the three named plans already committed under groma/plans, verify that the local application parses architecture through Comark, derives the C4 model, supports system-to-container-to-component decomposition, compares observed and planned snapshots, and reloads after Markdown changes. No source-code scanning may be introduced to make this test pass.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 An automated browser test opens groma/observed and navigates from the Groma system context to a container and one of its components
- [x] #2 Selecting a named plan demonstrates ghost additions, planned modifications, planned removals, and unchanged elements using controlled fixture differences
- [x] #3 Adding or editing a component Markdown file updates the already-open browser view
- [x] #4 Restarting the application from unchanged Markdown produces an equivalent C4 graph and revision comparison
- [x] #5 The verified workflow reads no project source files and contains no scanner implementation
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. Add a disposable controlled repository fixture and one consolidated automated browser gate that starts the real viewer on the observed revision, navigates Groma → Architecture workspace → component → back, then starts named plan 02-live-viewer and asserts addition, modification, removal, and unchanged states.
2. In the same gate, add and edit component Markdown while the comparison page remains open, prove a project source-file change does not advance the generation, and snapshot the exact selected/observed C4 models plus derived comparison.
3. Restart the real viewer against the unchanged fixture and require structural equality of both C4 graphs and comparison output; keep process and fixture cleanup in try/finally and capture console/overlay/screenshot evidence outside the repository.
4. Attempt the in-app Browser first, then run the explicitly permitted repository Playwright fallback if unavailable; run focused and full browser checks, architecture/unit checks, build, canonical-groma invariance, fixture/process cleanup, diff inspection, Backlog finalization, and commit main.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Added a consolidated disposable-repository Playwright gate. It starts the real server first on observed, navigates Groma → Architecture workspace → component → back, then starts named plan 02-live-viewer and verifies unchanged/modification/removal/addition from controlled Markdown. The same open plan page observes component add and edit rebuilds. A fixture src directory is unreadable during startup and a later .ts edit leaves generation/model/comparison unchanged. The gate restarts the server against unchanged Markdown and deep-compares selected C4 model, observed C4 model, and derived comparison. In-app Browser selection failed with “No browser is available” and an empty inventory, so the task-authorized Playwright fallback was used.

Final verification: npm run check validated observed plus all three named plans and passed 68/68 Node tests; a fresh npm run test:viewer:browser passed 8/8 Playwright flows including the release gate and existing desktop/mobile coverage; Bun production build bundled 146 modules. Controlled restart pages disconnect from SSE by navigating away before shutdown, so the release gate requires zero console warnings/page errors without filtering. Screenshot inspection showed distinct readable comparison states and the renamed live component. The release fixture and every viewer/fixture process were removed, git diff --check passed, canonical groma/ had no diff, and production src contains no scanner implementation.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Completed the Revision 02 release gate with one controlled, disposable end-to-end browser test and documented command. It proves observed three-level navigation, every comparison state for named plan 02-live-viewer, same-page Markdown add/edit reloads, source-file silence, and exact C4/comparison equivalence after restart. Verified by 68 Node tests, 8 Playwright flows, a 146-module Bun build, unchanged canonical Markdown, clean process/fixture teardown, and screenshot inspection.
<!-- SECTION:FINAL_SUMMARY:END -->
