---
id: GROM-104
title: Make linked builds immediately runnable
status: Done
assignee:
  - '@codex'
created_date: '2026-07-21 21:36'
updated_date: '2026-07-21 21:46'
labels: []
dependencies: []
type: bug
ordinal: 94000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Developers who link the Groma repository must have the groma command resolve to the repository's freshly built native executable. Building must not leave an older copied executable silently serving stale CLI or web behavior.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 On POSIX, the package exposes a groma executable that resolves through a Bun link to the repository build output
- [x] #2 After one bun link setup on POSIX, rebuilding dist/groma changes the executable used by the groma command without another link or copy step
- [x] #3 The documented local development loop distinguishes the POSIX one-time link setup from each rebuild, the standalone-copy workflow, and Windows rebuild-copy behavior
- [x] #4 Focused tests cover the linked command resolution behavior on supported hosts
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. Add the package-level `groma` bin mapping to the native `dist/groma` build output so Bun owns the linked development command. 2. Keep `install:local` as the distinct standalone-copy workflow. 3. Document the one-time `bun link` setup, rebuild loop, and migration from an older copied command. 4. Verify package metadata and actual isolated Bun-link behavior, including replacement of the build output.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Root cause confirmed: `bun link` registered the checkout, but package metadata had no `bin` mapping to `dist/groma`; an older `~/.local/bin/groma` copy therefore won PATH lookup and served stale embedded UI. Added the bin mapping. Live and isolated Bun-link checks both resolve the command through the linked package to `dist/groma` and observe a replaced build without relinking. Kept install:local as a standalone copy after Claude identified that making both workflows live links would create redundant shadowing mechanisms. Retired the exact local symlink created during diagnosis so this machine now resolves `groma` only through `~/.bun/bin`.

Final validation: native build completed; bare bun link registered the package; which -a groma resolves only /Users/alex/.bun/bin/groma; that link targets the linked package dist/groma; groma --version succeeds. The focused suite passed 4 tests including an isolated BUN_INSTALL link and replacement probe. Formatting and both TypeScript configurations passed. Two Terra xhigh reviews converged on documentation accuracy and behavioral link coverage; both were addressed. Claude feedback simplified the result to one live-development mechanism while preserving install:local as a durable copy.

Final Terra review identified that Bun's bin target is POSIX-only because Windows emits dist/groma.exe. Documentation and the package-metadata assertion now state that boundary, require Bun's global bin on PATH, and direct Windows developers to the existing rebuild-copy workflow. Focused tests and both TypeScript configurations remain green.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Added the POSIX Bun bin link so one-time bun link follows every rebuilt dist/groma, kept install:local as the explicit copy workflow, and documented PATH and Windows boundaries. Verified with the isolated Bun-link replacement test, the focused four-test suite, formatting, and both TypeScript configurations; PR #97 merged.
<!-- SECTION:FINAL_SUMMARY:END -->
