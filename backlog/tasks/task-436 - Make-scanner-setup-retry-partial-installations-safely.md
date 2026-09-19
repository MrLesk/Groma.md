---
id: TASK-436
title: Make scanner setup retry partial installations safely
status: Done
assignee:
  - '@codex'
created_date: '2026-09-19 08:20'
updated_date: '2026-09-19 08:23'
labels: []
dependencies: []
references:
  - modules-settings
  - web-server
modified_files:
  - test-bun/scanner-installation.test.ts
  - src/scanner/modules/setup.ts
  - src/viewers/web/server.ts
  - docs/scanners/setup.md
type: bug
ordinal: 509000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Browser setup retains successful scanner installations when a later package fails, but keeps a stale proposal. Retrying then fails with scanner source is already configured instead of continuing the remaining selection.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Retrying a partially completed setup selection retains successful scanners and installs remaining selected scanners without duplicate configuration or downloads.
- [x] #2 After an installation error, browser setup refreshes scanner state so successful installations are no longer offered for installation and remaining scanners remain selectable.
- [x] #3 Regression coverage reproduces partial failure and retry; bun run check passes.
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
1. Make selected setup installation consult current scanner configuration and skip retained selections.
2. Refresh browser discovery after each installation attempt, including failures.
3. Add focused partial-failure regression coverage, document retry behavior, and run bun run check.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Root cause: selected setup additions used the original discovery proposal after a partial failure, while successful packages had already been saved. Setup now checks current configured IDs before adding packages, and the web host refreshes discovery in a finally block before returning an installation error. This remains operational scanner configuration owned by scanner settings and the web host; it adds no OKF metadata or C4 concepts and makes no language-specific assumptions. Regression test failed before the fix and passes afterwards, including stale and refreshed proposal retries with the successful package unavailable at the registry. Focused scanner/startup checks: 5 passed. An isolated HTTP setup check exercised a real registry error twice with a previously retained scanner: installed checkbox removed, remaining checkbox present, original error retained, and no busy state or duplicate-install error. Specification and quality review traced POST /scanners through current configuration, installation, discovery refresh, and response; no blocking findings. Full bun run check is running.

Full validation passed: bun run check exited 0. Biome completed with existing findings outside this change (1 warning, 2 informational findings); TypeScript passed; Node tests 16 passed; Bun tests 598 passed, 35 skipped, 0 failed. git diff --check passed for all four changed files. The change is a bounded fix and adds no architecture concepts, dependencies, or compatibility behavior.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Setup retries read current project scanner selections and skip successful prior installations, preserving exact versions and avoiding duplicate downloads. Browser setup refreshes discovery after success or failure, so partial installations show the current choices. Verified with a failing-then-passing regression, an isolated HTTP installation-error check, and bun run check (16 Node and 598 Bun tests passed; 35 skipped).
<!-- SECTION:FINAL_SUMMARY:END -->
