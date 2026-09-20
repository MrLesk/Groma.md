---
id: TASK-446
title: Show real progress across web setup and loading
status: Done
assignee:
  - '@codex'
created_date: '2026-09-19 21:21'
updated_date: '2026-09-19 22:04'
labels: []
dependencies: []
references:
  - web-server
  - scanner-source-watch
  - scanner-session
  - web-page
  - scanner-registry
modified_files:
  - src/viewers/web/startup/progress.ts
  - src/scanner/source-watch.ts
  - src/scanner/session.ts
  - src/viewers/web/runtime.ts
  - src/viewers/web/startup/page.ts
  - src/viewers/web/map-session.ts
  - src/viewers/web/server.ts
  - test-bun/web-startup.test.ts
  - docs/viewers/web/index.md
  - src/scanner/registry.ts
  - design-qa.md
type: enhancement
ordinal: 519000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
The web startup screen combines project setup with ordinary loading and reports only a vague preparation message. Developers need distinct setup, first-scan, and regular-loading screens, with status text tied to the operation that is running. Alex approved all three screen roles from the mockups and asked for left-aligned regular loading.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Project setup keeps the project-name and architecture-folder inputs, readable setup navigation, and the existing scanner selection flow.
- [x] #2 First-run progress is a separate screen showing completed setup milestones and the current real preparation operation.
- [x] #3 Regular loading shows the project and version with a left-aligned status, without setup navigation.
- [x] #4 Startup status changes follow actual initialization, discovery, installation, scan, architecture loading and map preparation; operations that do not run are not claimed, and the map still waits for initial preparation.
- [x] #5 The three screens and the supported setup-to-map flow are verified in the browser; lifecycle tests, documentation, and bun run check cover the change.
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
1. Keep startup phases in the existing web host and deliver them through a small server-event stream, preserving the ready request and existing setup operations. 2. Report real operation boundaries from the scanner session and map loader without changing scanner results or stored architecture. 3. Implement all three approved screen roles with existing brand assets and theme tokens; left-align regular loading. 4. Verify gated startup and setup lifecycle, inspect the screens in the browser, document ownership and behavior, review the change, and run bun run check.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Compared active task file lists. TASK-445 overlaps map-session.ts and the web viewer docs while removing Open PR; requested coordination and will preserve its removals. All other active task files are outside this work. Setup, first scan and regular loading are complementary screens; the user approved all three and requested a left-aligned regular status.

Focused checks pass: 4 startup/source-watch tests, TypeScript, and lint on 8 changed files. The cold simplicity review found no blockers. Accepted its two cleanups: make firstRun required from the web host, and remove the unused project-name CSS rule. Readiness now covers active setup POST operations as well as map preparation, so an opened loading page waits for the operation that is actually running.

Browser QA: setup submits correctly, first scan shows completed setup milestones and the active scan, and reduced motion disables spinner animation. Fixed completed connector specificity so the first-scan progress matches the approved green completion state.

User correction: the first-scan screen must keep the surrounding card. Restored the shared card background, border, blur, and shadow around the connected progress steps; the three screens remain distinct within the same visual frame.

Confirmed design decision from Alex: use cards for setup, first scan, and regular loading. The regular status remains left-aligned.

Documented the three card screens, operation-driven progress, readiness, and ownership from the server through map/scanner callbacks to the browser. Progress is temporary web runtime state, not stored OKF knowledge or a C4 element.

Quality review found that newly supported fully excluded scanner inputs could still trigger the Scanning code status before the registry skipped the scanner. Added a lifecycle regression for that supported flow; the callback must be emitted at actual scanner invocation.

Final browser QA passed with cards on all three screens, left-aligned regular status, narrow and light/dark views, reduced motion, and both loading-to-map transitions. Nine focused tests pass. The excluded-source regression failed before and passed after moving the scan callback to actual invocation. Final bun run check passed: 16 Node tests, 611 Bun tests, 36 configured skips; only an unchanged iso-map test complexity warning remains. Appended evidence to design-qa.md without replacing earlier reports.

Implementer specification review: the three approved card screens preserve setup/scanner selection, show completed first-run milestones, omit setup navigation during regular loading, and use actual operation callbacks with readiness preserved. Browser evidence and lifecycle tests cover all five acceptance criteria. Quality review traced server entry points through initialization, scanner invocation, architecture reload, progress transport, and page state. The excluded-source status defect was reproduced and fixed; task-only diff has no whitespace errors or new complexity warnings. No other blocking findings remain.

Acceptance evidence: project/radio/scanner form interactions and desktop/narrow captures prove AC1; card progress captures and gated lifecycle tests prove AC2; compact card captures and DOM left-alignment prove AC3; phase-order, readiness, no-scanner, and fully-excluded scanner tests prove AC4; browser transitions, documentation, design QA, and the final complete repository check prove AC5. All changed source/test files remain below 500 lines. The local setup preview is left open at http://localhost:50365 with the artificial scan gates released.

Final full-context complexity review passed with no blockers or material simplification recommendations. It confirmed clear ownership: the web host owns startup state/readiness, scanner and map operations report their work, the progress stream transports updates, and the page owns the three card screens. No additional abstraction or restructuring is needed.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Implemented distinct setup, first-scan, and regular-loading card screens. Preserved project/folder inputs and scanner selection, added completed first-run milestones, and left-aligned regular status. Progress follows actual initialization, discovery, installation, scanning, architecture loading, and map preparation; skipped scanners do not claim a scan, and the map waits for preparation. Verified desktop and narrow layouts, light/dark and reduced motion, setup and both loading-to-map paths, nine focused lifecycle/exclusion tests, and bun run check (16 Node tests, 611 Bun tests passed, 36 configured skips). Design QA and required reviews passed. Updated web documentation and retained unrelated work.
<!-- SECTION:FINAL_SUMMARY:END -->
