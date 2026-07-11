---
id: GROM-5
title: Bootstrap the TypeScript and Bun single-binary workspace
status: Done
assignee:
  - '@codex'
created_date: '2026-07-11 17:33'
updated_date: '2026-07-11 20:34'
labels:
  - bootstrap
  - tooling
  - bun
milestone: m-1
dependencies:
  - GROM-4
references:
  - MANIFESTO.md
  - ARCHITECTURE.md
priority: high
ordinal: 2000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Create the implementation workspace and development conventions for the approved TypeScript and Bun stack. The first deliverable is a compiled single-file groma executable; Bun embedded HTTP serving and Bun React bundling are recorded as the later service and web path without implementing those surfaces in 1A.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 A clean clone installs deterministically from the committed Bun lockfile and passes the documented development commands
- [x] #2 The repository has explicit source boundaries for technology-neutral Core, the standard model, persistence providers, application operations, and host or CLI adapters
- [x] #3 Technology-neutral Core modules do not import Bun, filesystem, Markdown, CLI, HTTP, or React implementations
- [x] #4 The build produces one executable file that reports version and help information without a Bun runtime installed separately
- [x] #5 Development documentation records TypeScript, Bun, the single-file binary, Bun embedded server, and Bun React bundler as the approved stack and identifies which pieces are deferred beyond 1A
- [x] #6 The 1A build target support matrix and local commands for type checking, testing, formatting, and compilation are documented
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. Add the minimal Bun package, TypeScript configuration, source layout, and deterministic lockfile.
2. Establish import boundaries and public entry points corresponding to the architecture groups.
3. Add the executable entry point and compiled-binary build command.
4. Document development commands, supported 1A build targets, and the approved later server and React bundling path.
5. Verify clean-clone installation and execution without a separately installed Bun runtime.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Started after GROM-4 published the reviewed bootstrap baseline to private repository MrLesk/Groma.md.

Context-hunter classification: L2 architecture-impacting foundation with no local code analogues. Chose internal source boundaries named from ARCHITECTURE.md rather than premature publishable packages. Pinned Bun 1.3.14, TypeScript 7.0.2, @types/bun 1.3.14, and Prettier 3.9.5. The compiled build disables runtime dotenv, bunfig, tsconfig, and package.json autoload. Initial 1A matrix commits to macOS arm64 and Linux x64 baseline; only macOS runtime support is claimed until GROM-6 adds Linux CI.

Validation passed in the working tree: bun ci; bun run typecheck; bun run format:check; bun run test (6 pass); native bun run build and smoke; execution with PATH limited to /usr/bin:/bin; Linux x64 baseline cross-compilation; one file under dist. The clean-clone criterion remains pending until the implementation commit is available to clone.

Fresh-clone validation passed from the pushed agent/bootstrap-bun-workspace branch: bun ci installed the exact lock; dev/version, typecheck, format, format:check, six tests, native build, smoke, Bun-free PATH execution, one-artifact check, and Linux x64 baseline cross-build all passed; formatting left no Git diff.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Bootstrapped Groma as a strict TypeScript 7 and Bun 1.3.14 project with deterministic bun.lock installs, architecture-derived internal source boundaries, a minimal tested CLI seam, and a reproducible single-file executable build. Documented the approved Bun server and React bundler path, deferrals, development commands, and initial macOS arm64 plus Linux x64 baseline target matrix. Verified every documented command from a fresh remote clone.
<!-- SECTION:FINAL_SUMMARY:END -->
