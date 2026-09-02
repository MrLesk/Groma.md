---
id: TASK-235
title: Remove presentation-only automated tests
status: Done
assignee:
  - '@codex'
created_date: '2026-09-01 20:59'
updated_date: '2026-09-02 17:46'
labels: []
dependencies: []
modified_files:
  - test/instructions.test.ts
  - test/plain-world.test.ts
  - test-bun/theme.test.ts
  - test-bun/tui-theme.test.ts
  - test-bun/iso-scale.test.ts
  - test-bun/welcome.test.ts
  - test/cli-scan.test.ts
  - test/cli-view.test.ts
  - test/create.test.ts
  - test/accept.test.ts
  - test/relate.test.ts
  - test/edit.test.ts
  - test/curate.test.ts
  - test-bun/okf-writers.test.ts
  - test-bun/openclaw-view.test.ts
  - test-bun/web-page.test.ts
  - test-bun/web-map-debug.test.ts
  - test-bun/okf-profile-view.test.ts
  - test-bun/work-pins.test.ts
  - test-bun/scanner-modules.test.ts
  - test-bun/web-export.test.ts
  - test/initialize.test.ts
  - test-bun/work.test.ts
  - test/validate-architecture.test.ts
  - test/project-profile.test.ts
  - test-bun/web-svg-performance.test.ts
  - test-bun/sheet-route.test.ts
  - test-bun/web-live.test.ts
  - test-bun/action-path.test.ts
  - test-bun/inspect-details.test.ts
  - test-bun/chrome.test.ts
  - test-bun/viewer-lifecycle.test.ts
  - test/scan-watch.test.ts
type: chore
ordinal: 257000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Keep the automated suite focused on business behavior. Remove tests whose only purpose is to freeze prose, command output, prompt wording, colors, frame text, help content, or other presentation details. Rewrite a test only when the same setup can prove a real state, lifecycle, navigation, projection, layout, camera, world-immutability, or domain invariant without asserting decorative content.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Tests that only assert exact prose, prompt wording, command output, colors, frame text, help text, or decorative content are removed
- [x] #2 Tests that mix presentation assertions with real business invariants retain only the invariant-focused coverage
- [x] #3 Production code is unchanged
- [x] #4 The remaining automated suite passes the repository check
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
1. Remove tests devoted only to welcome/instruction/help/plain-output wording, exact colours, or decorative scale values.
2. Strip stdout, stderr wording, rendered-frame prose, and exact presentation assertions from mixed tests while preserving state, lifecycle, persistence, navigation, projection, layout, and immutability checks.
3. Run affected test groups and the full repository check, then audit the diff to confirm no production files changed.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Removed presentation-only suites and assertions across the Node and Bun test domains. Deleted the plain-world, terminal-colour, and decorative scale suites; reduced welcome, instructions, help, CLI, rendering, theme, and error tests to business state or lifecycle checks; retained navigation, projection, layout, camera, persistence, and lifecycle coverage.

Corrected one existing Work test that accidentally depended on filesystem order and added watcher startup time so the lifecycle test remains parallel-safe. Restored this task’s two scanner-evidence edits after detecting overlapping TASK-236 work, and removed that file from TASK-235 traceability.

The cold simplicity review found no blocking issue. Its cleanup suggestions were accepted: unused stdout capture was removed from scan, initialization, and scan-watcher helpers; unused stderr capture was removed from the OKF CLI helper; obsolete export fixture sentinels were removed.

The implementer specification review passed all four acceptance criteria. The implementer quality review found no production change, unclear ownership, new shared fixture, or concurrency risk. The full-context complexity review found no blocking issue and recommended keeping the direct deletion approach. It noted only that test-bun/sheet-route.test.ts now contains coordinated TASK-235 and TASK-237 hunks, which must remain separate when committing.

Verification: focused Node tests passed 55/55; affected Bun tests passed; bun run check passed with 91 Node tests and 211 Bun tests after the cold-review cleanup. Biome reported only the repository’s existing complexity warnings and TypeScript passed. The later scan-watcher helper cleanup passed its focused lifecycle test and git diff --check. A subsequent full check, run while TASK-237 was actively changing src/sheet/route.ts and the shared routing test, failed in that in-progress routing flow plus one watcher timeout; those failures are outside TASK-235 and the parent agent was notified. No production file is recorded for TASK-235.

Independent implementer review confirmed the 33-file diff is test-only. Removed assertions are limited to exact output, prose, help text, frame content, colours, formatting, and decorative scale values. Mixed tests still verify exit state, written architecture, rejection without writes, target resolution, scanner inventory, viewer lifecycle, navigation, projection, exported artifacts, watcher behavior, and world immutability. No production file changed and no useful business invariant was found missing.

Final verification on the current branch: bun run check passed. Biome completed with the repository's 28 existing complexity warnings, TypeScript passed, 91 Node tests passed, and 212 Bun tests passed. Two architecture-watcher tests timed out under an earlier parallel run, then passed both in an isolated 11-test run and in the final complete run.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Removed presentation-only automated coverage and reduced mixed tests to business state, lifecycle, persistence, navigation, projection, layout, camera, and immutability assertions. Deleted three decorative suites, removed unused process-output capture, and kept production code unchanged. Independently reviewed the full 33-file diff and verified it with bun run check: 91 Node tests and 212 Bun tests passed.
<!-- SECTION:FINAL_SUMMARY:END -->
