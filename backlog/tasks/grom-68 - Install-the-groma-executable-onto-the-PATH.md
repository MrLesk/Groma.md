---
id: GROM-68
title: Install the groma executable onto the PATH
status: Done
assignee:
  - '@claude'
created_date: '2026-07-20 06:23'
updated_date: '2026-07-20 06:26'
labels:
  - cli
  - build
milestone: m-4
dependencies: []
references:
  - scripts/build.ts
  - ../backlog.md/package.json
priority: high
type: feature
ordinal: 65000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Typing groma anywhere currently fails (zsh even reports permission denied when the shell resolves the groma/ workspace directory instead of a binary), while backlog works out of the box because its compiled executable is installed on the PATH. Give Groma the same one-command local install: bun run install:local builds the native executable and installs it into a PATH directory, so groma web starts the embedded blueprint server from any directory exactly like backlog browser. Publishing to npm with per-platform packages stays later work; this task covers the local checkout install.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 bun run install:local builds the native executable, copies it into the first existing user bin directory on the PATH (~/.local/bin, then ~/.bun/bin, creating ~/.local/bin if neither exists), marks it executable, and proves the installed binary answers --version before reporting success
- [x] #2 The installer prints the installed path and version, warns with a concrete export line when the destination is not on the PATH, and reminds about rehash for the current shell
- [x] #3 An explicit --dest <dir> overrides the destination and --skip-build reuses an existing dist build; a missing build fails with a clear message instead of installing nothing
- [x] #4 A script test covers the copy, executable bit, version probe, and missing-binary failure using an injected destination; POSIX-only behavior is gated and Windows prints guidance pointing at dist\groma.exe
- [x] #5 README and DEVELOPMENT.md document the install command; after installation groma web serves the blueprint from a directory outside the repo
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. scripts/install-local.ts: parse --dest and --skip-build, run the standard build unless skipped, resolve the destination (explicit dest, else ~/.local/bin if present, else ~/.bun/bin if present, else create ~/.local/bin), copy dist/groma with mode 755, probe the installed binary with --version, print path, version, PATH membership warning with export line, and a rehash hint; on Windows without --dest print guidance for dist\groma.exe.
2. package.json script install:local; README build section and DEVELOPMENT commands list document it.
3. scripts/tests/install-local.test.ts (POSIX-gated): exercises copy, executable bit, version probe against a stub binary via --dest and --skip-build with an injected source, and the missing-binary failure path.
4. Verify: bun run check, then run the installer for real and prove groma --version, groma instructions, and groma web serve from a directory outside the repository.
Supported boundary: local checkout installation only; npm publishing, per-platform packages, and self-update remain later work.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
scripts/install-local.ts builds via the standard build script, resolves the destination (explicit --dest, else the first existing of ~/.local/bin and ~/.bun/bin, else a created ~/.local/bin), copies with mode 755, and refuses to report success unless the installed binary answers --version. Root cause of Alex's zsh permission-denied: nothing installed a groma binary, and shell lookup found the groma/ workspace directory instead.
Validation: bun run check green (442 tests incl. two POSIX-gated installer tests with an injected stub binary and the missing-build failure). Real run installed groma 0.0.0 at ~/.local/bin/groma (first PATH directory); from an unrelated directory, which groma resolves, groma --version answers, and after groma init, groma web serves the embedded blueprint shell and a bounded read on an ephemeral port — backlog browser parity. The off-PATH warning with its export line verified with --dest to a temporary directory.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
bun run install:local builds the native executable and installs it onto the PATH (~/.local/bin first), with a version probe before success, PATH and rehash guidance, --dest/--skip-build overrides, Windows guidance, tests, and docs. Verified end to end: the installed groma serves groma web from a directory outside the repository, matching how backlog browser works out of the box.
<!-- SECTION:FINAL_SUMMARY:END -->
