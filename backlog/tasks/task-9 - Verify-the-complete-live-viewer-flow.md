---
id: TASK-9
title: Verify the complete live-viewer flow
status: Done
assignee:
  - '@codex'
created_date: '2026-07-27 20:55'
updated_date: '2026-07-28 00:15'
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

5. Strengthen live-edit evidence with a unique in-page sentinel established before mutation and asserted after both add and edit DOM updates, so a document reload fails the gate.

6. Capture the pre-restart viewer PID, require a valid distinct post-restart PID, and add deterministic projectArchitectureView snapshots for context, container, and Architecture workspace component focus paths to the structural restart comparison.

7. Refactor viewer teardown and outer cleanup so exit assertions are collected without preventing process termination, permission restoration, or fixture removal, even when teardown itself fails.

8. Run focused intentional assertion sanity checks where feasible, then focused/full Playwright, unit/architecture checks, production build, canonical Markdown/process/fixture hygiene, Backlog finalization, and direct commit.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Added a consolidated disposable-repository Playwright gate. It starts the real server first on observed, navigates Groma → Architecture workspace → component → back, then starts named plan 02-live-viewer and verifies unchanged/modification/removal/addition from controlled Markdown. The same open plan page observes component add and edit rebuilds. A fixture src directory is unreadable during startup and a later .ts edit leaves generation/model/comparison unchanged. The gate restarts the server against unchanged Markdown and deep-compares selected C4 model, observed C4 model, and derived comparison. In-app Browser selection failed with “No browser is available” and an empty inventory, so the task-authorized Playwright fallback was used.

Final verification: npm run check validated observed plus all three named plans and passed 68/68 Node tests; a fresh npm run test:viewer:browser passed 8/8 Playwright flows including the release gate and existing desktop/mobile coverage; Bun production build bundled 146 modules. Controlled restart pages disconnect from SSE by navigating away before shutdown, so the release gate requires zero console warnings/page errors without filtering. Screenshot inspection showed distinct readable comparison states and the renamed live component. The release fixture and every viewer/fixture process were removed, git diff --check passed, canonical groma/ had no diff, and production src contains no scanner implementation.

Spec review reopened TASK-9: the initial gate did not prove same-document continuity, distinct process identity, or deterministic projected views across restart, and teardown assertion failure could bypass fixture removal. Acceptance criteria 3 and 4 are unchecked pending stronger objective evidence.

Review corrections implemented in the release gate only; no runtime defect was found. A unique window sentinel is set before the Markdown addition and remains identical after both add and edit DOM updates. The observed, pre-restart plan, and restarted child PIDs are validated, with the restart required to use a distinct PID. Structural snapshots now include full deterministic projectArchitectureView results for context, container, and Architecture workspace component focus paths, including comparison-status node data and relationship status/label projection. Startup failure terminates its child, and nested final cleanup restores permissions/removes the fixture even if stopViewer assertions throw. Controlled negative runs proved a forced page reload returns an undefined sentinel, an inverted PID expectation reports the real distinct PIDs, and an intentionally wrong exit-code expectation still leaves no viewer process or fixture. Restored focused gate passes 1/1.

Fresh correction verification: npm run test:release-gate passed 1/1 after all controlled negative checks were reverted; npm run test:viewer:browser passed 8/8 flows; npm run check validated all four revisions and passed 68/68 Node tests; Bun production build bundled 146 modules. The fresh screenshot shows all four comparison states, both projected relationships, and the renamed live component. git diff --check and canonical groma/ invariance passed, with no disposable fixture or viewer process remaining.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Completed TASK-9 and its rigor correction. The controlled release gate now proves live Markdown updates preserve the exact browser document, restart uses a distinct process, and full deterministic context/container/component projections—including comparison statuses and relationships—are structurally identical after restart. Teardown remains fixture/process-safe even when its own assertions fail. Verified by deliberate negative checks, 1/1 focused gate, 8/8 browser flows, 68 Node tests, successful 146-module build, unchanged canonical Markdown, and clean process/fixture hygiene.
<!-- SECTION:FINAL_SUMMARY:END -->
