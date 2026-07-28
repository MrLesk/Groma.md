---
id: TASK-9
title: Verify the complete live-viewer flow
status: Done
assignee:
  - '@codex'
created_date: '2026-07-27 20:55'
updated_date: '2026-07-28 00:30'
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
  - playwright.release-gate.config.mjs
  - e2e/release-gate.spec.js
  - src/architecture-reader.mjs
  - src/viewer/markdown-watcher.mjs
  - src/viewer/server.mjs
  - test/architecture-reader.test.mjs
  - test/markdown-watcher.test.mjs
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

9. Give test:release-gate a dedicated Playwright config with no webServer entries, then prove it remains green while port 4177 is occupied.

10. Bound viewer termination: await SIGTERM for a fixed interval, escalate to SIGKILL with another bound, and close/await stdout and stderr; add a deliberately SIGTERM-stalled child probe.

11. Move partial-fixture cleanup into createFixture and add a forced post-mkdtemp setup-failure probe that requires the directory to be gone.

12. Add a NODE_ENV=test-gated filesystem access audit threaded through the real Comark reader and Markdown watcher, expose it only in test payloads, fence a source mutation with a completed known Markdown generation, assert every read/watch stayed under groma, and add a static no-scanner guard.

13. Repeat the isolated gate, occupied-port gate, full browser suite, unit/architecture checks, production build, intentional teardown/setup probes, canonical Markdown and residue checks; then refinalize and commit.

14. Replace outcome-derived shutdown expectations with an explicit expected mode: every real viewer stop defaults to and asserts graceful SIGTERM/no escalation, while only the deliberately stalled child declares forced SIGKILL as expected. Add visible returned-result assertions at real restart boundaries, repeat isolated/full verification, and refinalize.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Added a consolidated disposable-repository Playwright gate. It starts the real server first on observed, navigates Groma → Architecture workspace → component → back, then starts named plan 02-live-viewer and verifies unchanged/modification/removal/addition from controlled Markdown. The same open plan page observes component add and edit rebuilds. A fixture src directory is unreadable during startup and a later .ts edit leaves generation/model/comparison unchanged. The gate restarts the server against unchanged Markdown and deep-compares selected C4 model, observed C4 model, and derived comparison. In-app Browser selection failed with “No browser is available” and an empty inventory, so the task-authorized Playwright fallback was used.

Final verification: npm run check validated observed plus all three named plans and passed 68/68 Node tests; a fresh npm run test:viewer:browser passed 8/8 Playwright flows including the release gate and existing desktop/mobile coverage; Bun production build bundled 146 modules. Controlled restart pages disconnect from SSE by navigating away before shutdown, so the release gate requires zero console warnings/page errors without filtering. Screenshot inspection showed distinct readable comparison states and the renamed live component. The release fixture and every viewer/fixture process were removed, git diff --check passed, canonical groma/ had no diff, and production src contains no scanner implementation.

Spec review reopened TASK-9: the initial gate did not prove same-document continuity, distinct process identity, or deterministic projected views across restart, and teardown assertion failure could bypass fixture removal. Acceptance criteria 3 and 4 are unchecked pending stronger objective evidence.

Review corrections implemented in the release gate only; no runtime defect was found. A unique window sentinel is set before the Markdown addition and remains identical after both add and edit DOM updates. The observed, pre-restart plan, and restarted child PIDs are validated, with the restart required to use a distinct PID. Structural snapshots now include full deterministic projectArchitectureView results for context, container, and Architecture workspace component focus paths, including comparison-status node data and relationship status/label projection. Startup failure terminates its child, and nested final cleanup restores permissions/removes the fixture even if stopViewer assertions throw. Controlled negative runs proved a forced page reload returns an undefined sentinel, an inverted PID expectation reports the real distinct PIDs, and an intentionally wrong exit-code expectation still leaves no viewer process or fixture. Restored focused gate passes 1/1.

Fresh correction verification: npm run test:release-gate passed 1/1 after all controlled negative checks were reverted; npm run test:viewer:browser passed 8/8 flows; npm run check validated all four revisions and passed 68/68 Node tests; Bun production build bundled 146 modules. The fresh screenshot shows all four comparison states, both projected relationships, and the renamed live component. git diff --check and canonical groma/ invariance passed, with no disposable fixture or viewer process remaining.

Quality review reopened TASK-9: the release command inherits unrelated fixed-port webServers, viewer teardown is unbounded and does not await stdio, createFixture can leak after partial setup, and source silence uses a fixed delay rather than auditable read/watch scope plus a generation fence. Acceptance criteria 3–5 are unchecked until the isolated deterministic harness is verified.

Implemented the deterministic harness corrections. test:release-gate now uses playwright.release-gate.config.mjs with no webServer or baseURL and passed 4/4 while a real TCP listener occupied 127.0.0.1:4177. stopViewer has bounded SIGTERM, bounded SIGKILL escalation, and bounded stdout/stderr completion; a SIGTERM-ignoring child probe escalates to SIGKILL and confirms ESRCH afterward. createFixture owns cleanup from immediately after mkdtemp; a forced setup hook failure proves ENOENT. A NODE_ENV=test/GROMA_TEST_IO_AUDIT seam records actual reader/watcher read-directory/read-file/watch paths in the test API only. Source mutation is followed by a known README generation fence, then full model/projection equality and an all-access-under-groma assertion; the fixed 500ms delay is removed. A static production-src scanner guard and focused reader/watcher audit tests are included. Current isolated gate passes repeatedly at 4/4; focused audit tests pass 11/11.

Fresh final quality verification: the isolated release command passed 4/4 repeatedly, including once with 127.0.0.1:4177 actively occupied; the full Playwright suite passed 11/11; npm run check validated all four revisions and passed 70/70 Node tests; Bun bundled 146 modules. The SIGTERM-stall probe exercised bounded SIGKILL and awaited stdio, the forced partial-setup probe removed its root, the source mutation was fenced by a completed Markdown generation with structural equality and audited groma-only read/watch scope, and the static guard found no scanner or unexpected production filesystem reader. Fresh screenshot inspection remained readable. git diff --check and canonical groma/ invariance passed; no port listener, viewer/stall process, or disposable release fixture remained.

Final quality review reopened TASK-9: stopViewer currently derives its expected exit from whether escalation happened, allowing an unexpectedly hung real viewer to pass after SIGKILL. Acceptance criterion 4 is unchecked until real restart boundaries require graceful SIGTERM and the forced path is confined to the stalled-child probe.

Final quality correction: stopViewer now takes an explicit expectedShutdown contract. All real viewer stop/restart paths use the default graceful contract and assert exit code 0, no signal, and no escalation; only the deliberately stalled-child regression declares forced shutdown and asserts SIGKILL escalation. A controlled negative regression (temporarily omitting the forced declaration) failed as intended when escalation occurred, proving escalation is not dynamically accepted. Verification after restoration: isolated release gate 4/4, full browser suite 11/11, npm run check 70/70 Node tests with all revisions validated, Bun production build 146 modules, canonical groma tree unchanged, and no temporary fixture or viewer-process residue.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Separated shutdown expectations in the Revision 02 release gate: normal real-viewer stop and restart operations are required to complete gracefully under SIGTERM without escalation, while only the explicit stalled-child probe opts into and verifies SIGKILL escalation. Added returned-result assertions and a negative regression proving unexpected escalation fails. Reverified the isolated release gate, full browser suite, complete check suite, production build, canonical fixture integrity, and cleanup hygiene.
<!-- SECTION:FINAL_SUMMARY:END -->
