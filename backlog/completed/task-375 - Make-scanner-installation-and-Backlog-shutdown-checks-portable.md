---
id: TASK-375
title: Make scanner installation and Backlog shutdown checks portable
status: Done
assignee:
  - '@codex'
created_date: '2026-09-13 14:27'
updated_date: '2026-09-13 14:31'
labels: []
dependencies: []
references:
  - modules-settings
  - backlog-plugin
modified_files:
  - test-bun/scanner-installation.test.ts
  - test-bun/backlog-lifecycle.test.ts
type: bug
ordinal: 421000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
CI run 34762384001 fails on Windows when tar receives an absolute drive-letter archive path, and on Linux when the wrapped Backlog shutdown test reports a native PID as still alive. Resolve the platform differences while retaining installation, shutdown and isolation assertions.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Scanner installation fixtures create archives on Windows and Unix without interpreting a drive letter as a remote archive host.
- [x] #2 The Backlog shutdown test distinguishes a running process from an exited unreaped process and still detects a surviving worker or unrelated subscription being stopped.
- [x] #3 The complete repository check passes locally and the pushed CI run passes Ubuntu, macOS and Windows.
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
Use relative archive paths and an explicit working directory in the package fixture. Reproduce the Linux PID-state observation and correct its liveness probe without retries or timing relaxations. Run focused and full checks, commit only the CI fix, push to main and inspect all matrix jobs.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Diagnosed CI run 34762384001: Windows tar exits 2 with an absolute drive-letter archive path; GNU tar treats colons in archive names as remote hosts. The fixture now uses relative archive and input-directory paths under an explicit cwd, and surfaces tar stderr on failure. Unix shutdown previously equated PID existence with execution; a terminated child can remain as a zombie until reaped. The test now reads ps state, excludes Z, and retains every shutdown/isolation assertion and timeout. No production behavior or CI workflow changed. Four focused tests passed locally. Docker is installed but its daemon is unavailable, so Linux and Windows verification will use the actual CI matrix. References: https://www.gnu.org/software/tar/manual/tar.html and https://www.man7.org/linux/man-pages/man2/wait.2.html.

Full local bun run check passed: 305 tests, six existing native skips, zero failures. git diff --check passed. Own specification and quality review: the tar change affects only disposable package creation; the process-state probe still treats running or stopped workers as alive and distinguishes exited zombies. Existing isolation assertions detect a surviving worker or incorrectly stopped second subscription. Ready for matrix verification.

Pushed commit 6e0a7e32e30b1f632c3144bbdf3386d0f66cad33 to main. GitHub Actions run 34762760869 passed all three matrix jobs: Ubuntu, macOS and Windows, including repository checks and standalone binary builds. This verifies the archive fix on Windows and the shutdown/isolation assertions on Linux. No workflow skips, retries, timeout increases or production changes were introduced. CI evidence: https://github.com/MrLesk/Groma.md/actions/runs/34762760869
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Fixed cross-platform CI test failures by creating fixture archives with relative paths and checking Unix process execution state instead of PID existence. The shutdown and isolation assertions remain intact. Full local checks passed, and pushed commit 6e0a7e3 passed Ubuntu, macOS and Windows CI checks and builds in run 34762760869.
<!-- SECTION:FINAL_SUMMARY:END -->
