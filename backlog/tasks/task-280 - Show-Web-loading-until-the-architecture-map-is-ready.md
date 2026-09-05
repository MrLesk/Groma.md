---
id: TASK-280
title: Show Web loading until the architecture map is ready
status: Done
assignee:
  - '@codex'
created_date: '2026-09-05 20:17'
updated_date: '2026-09-05 20:22'
labels: []
dependencies: []
references:
  - web-server
modified_files:
  - features/startup.feature
  - test-bun/web-startup.test.ts
  - src/viewers/web/server.ts
  - src/viewers/web/startup/page.ts
type: bug
ordinal: 319000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
When a developer opens Groma as soon as its local server is reachable, an initialized project currently shows a failure page without an error while scanning and map preparation are still running. Reuse the existing setup surface to show loading, then open the ready map automatically at the same address. Actual failures must show their error.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Opening an initialized project during startup shows a loading screen rather than a failure or setup form.
- [x] #2 The loading screen opens the ready map automatically at the same address when preparation completes.
- [x] #3 A startup failure ends loading and shows the actual error; uninitialized projects retain their setup flow.
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
Keep startup readiness in the existing Web server. Reuse its one preparation promise for a readiness request that waits until startup completes, and reuse the setup page shell for loading. The browser waits once, then reloads into the ready map or actual failure. Add focused fixture-based startup transition tests, run bun run check, and obtain the requested full-context complexity review.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
A paused scanner reproduced the exact blank-error page before the fix. Startup now owns one preparation promise; the existing setup surface derives its loading state from initialization without an error, and waits once on /ready before reloading. Success and failure use the same completion path. The startup feature scenario documents the supported behavior. No C4 or OKF model change is needed: this remains Web server lifecycle state and ordinary architecture Markdown is unchanged.

Specification and quality review: all three startup outcomes remain owned by the existing server and setup page, with no new persisted state, polling loop, framework, or architecture concept. A browser fixture verified loading followed by automatic navigation to the map at the same URL. All six startup tests passed in the full run, as did 105 Node tests and typechecking. The full run failed only on the previously documented concurrent architecture-read/remove race in web-authoring (ENOENT for support-agent.md); the seven lint warnings are pre-existing and outside this change. Repeating the required check once after identifying that transient race.

The required check passed: 105 Node tests and 310 Bun tests, with seven pre-existing complexity warnings and no new warnings. The real in-app browser verified loading-to-map and loading-to-actual-error transitions at the same URL. Full-context complexity review found no blockers or material architecture changes; it recommends keeping the existing server/page ownership and paused-scanner tests. Applied its sole cleanup: delete the unused startup property from the test helper return value.

Final check after the test-helper cleanup passed with 105 Node tests and 310 Bun tests. The scoped diff is clean. Both browser transitions were verified and temporary preview servers were closed.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Web startup now shows the existing branded loading screen while scanning and preparing the map. It waits once for completion and automatically reloads the same URL into the map or a readable actual error. Verified with paused-scanner regression tests, real in-app browser success and failure transitions, and the full repository check (105 Node and 310 Bun tests). Full-context complexity review passed with one unused test return value removed.
<!-- SECTION:FINAL_SUMMARY:END -->
