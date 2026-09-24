---
id: TASK-518
title: Pass CI on Windows
status: Done
assignee:
  - '@claude'
created_date: '2026-09-24 11:21'
updated_date: '2026-09-24 11:42'
labels: []
dependencies: []
references:
  - history-revisions
modified_files:
  - src/history/revisions.ts
  - test-bun/swift-scanner.test.ts
  - test-bun/react-scanner.test.ts
  - test-bun/rust-workspace.test.ts
  - test-bun/execution-evidence-native.test.ts
priority: high
type: bug
ordinal: 599000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Requested by Alex on 2026-09-24 ("check ci and fix it as soon as possible"). The CI workflow has failed on every completed run since 2026-09-21. The same six tests fail on windows-latest each time; ubuntu-24.04 sometimes fails one of them. Causes: src/history/revisions.ts gives the temporary snapshot directory to tar as -C C:\...\groma-revision-*, which the runner's GNU tar (Git for Windows) cannot open, so reading a revision snapshot fails on Windows (two web history and export tests). The Swift duplicate test and the React handler test edit fixture text that a Windows checkout ends with CRLF, but they search for \n. The Cargo binaries test compares path.relative output, which uses backslashes on Windows, with forward-slash paths. The Swift entry-point test in test-bun/execution-evidence-native.test.ts builds the Swift worker from source instead of the package CI caches in GROMA_TEST_SWIFT_PACKAGE, and passes its 60 s timeout on Windows and sometimes on Ubuntu.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Reading a revision snapshot works on Windows: tar extracts the Git archive in the snapshot directory without receiving that directory as a path argument
- [x] #2 The Swift, React and Cargo tests pass on a Windows checkout without changing what they assert
- [x] #3 The Swift entry-point test uses the prebuilt Swift package when GROMA_TEST_SWIFT_PACKAGE is set
- [x] #4 The CI workflow passes on ubuntu-24.04, macos-latest and windows-latest
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
1. src/history/revisions.ts: run tar -x in the snapshot directory (spawn cwd) instead of passing it with -C, so no Windows drive path reaches tar's arguments.
2. test-bun/swift-scanner.test.ts: find the multi-line signature's line with split(/\r?\n/).
3. test-bun/react-scanner.test.ts: remove the local receive definition without matching its line ending.
4. test-bun/rust-workspace.test.ts: compare repository-relative paths with forward slashes, as the scanner writes them.
5. test-bun/execution-evidence-native.test.ts: the Swift test copies GROMA_TEST_SWIFT_PACKAGE when it is set, as test-bun/swift-scanner.test.ts does, instead of compiling the worker.
6. Verify: bun run check in a worktree; run the CI workflow on a scratch branch with workflow_dispatch to see windows-latest pass before committing to main; delete the branch after.

Tests: no new tests or assertions. Items 2 to 5 fix how existing tests read their own fixtures and build their inputs on Windows; each keeps its assertions.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Evidence: the CI runs for TASK-510 through TASK-516 (2026-09-24) fail the same six tests on windows-latest; ubuntu-24.04 failed once on the Swift entry-point timeout (60005 ms, TASK-510) and once in setup-swift (TASK-504, infrastructure).
Root causes: tar -x -C <destination> in extractArchive (the runner's GNU tar reports "C\:\\Users\...\groma-revision-*: Cannot open"); the Swift test's split('\n') line lookup and the React test's replace(...\n) both miss on CRLF fixture checkouts (no .gitattributes, Windows checks out with CRLF), so the React test left the local receive in host.tsx and the row pointed at host.tsx; the Cargo test compared path.relative output (backslashes on Windows); the Swift entry-point test compiled the worker instead of copying the cached package.
Kept CRLF fixtures on Windows instead of adding .gitattributes eol=lf: the Windows job then keeps scanning CRLF sources, as Windows users' checkouts do.
Local (macOS): the six affected test files pass (39 pass, 4 skip, 0 fail). CI: scratch branch ci/task-518 at 25debfb4 (main 6318ba7f plus these five files), workflow_dispatch run 35992695551.

CI on ci/task-518 (run 35992695551, workflow_dispatch): ubuntu-24.04, macos-latest and windows-latest all succeed, including the standalone binary build that had not run on Windows since the checks failed. On windows-latest the six tests pass: commit export 9387 ms, web history 2344 ms, Swift comparable bodies 697 ms, React handler 1069 ms, Cargo binaries 68 ms, and the Swift entry-point test 752 ms (it timed out at 60000 ms when it compiled the worker). bun run check in a worktree at 25debfb4: Biome, types and the Node suite pass; Bun 723 pass, 45 skip, 0 fail.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
CI had failed on every completed run since 2026-09-21 because of six Windows failures. Reading a revision snapshot now runs tar in the snapshot directory instead of passing it with -C, which Git for Windows' GNU tar could not open; this also fixes revision history and commit export for Windows users. Three tests assumed a POSIX checkout: the Swift duplicate and React handler tests now tolerate CRLF fixture lines, and the Cargo test compares forward-slash paths. The Swift entry-point test copies the Swift package CI caches instead of compiling the worker past its 60 s timeout. No assertions changed. Verified by bun run check locally and by a workflow_dispatch CI run on a scratch branch that passed on ubuntu-24.04, macos-latest and windows-latest.
<!-- SECTION:FINAL_SUMMARY:END -->
