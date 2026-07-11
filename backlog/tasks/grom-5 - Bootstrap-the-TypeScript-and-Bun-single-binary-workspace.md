---
id: GROM-5
title: Bootstrap the TypeScript and Bun single-binary workspace
status: To Do
assignee: []
created_date: '2026-07-11 17:33'
updated_date: '2026-07-11 17:36'
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
- [ ] #1 A clean clone installs deterministically from the committed Bun lockfile and passes the documented development commands
- [ ] #2 The repository has explicit source boundaries for technology-neutral Core, the standard model, persistence providers, application operations, and host or CLI adapters
- [ ] #3 Technology-neutral Core modules do not import Bun, filesystem, Markdown, CLI, HTTP, or React implementations
- [ ] #4 The build produces one executable file that reports version and help information without a Bun runtime installed separately
- [ ] #5 Development documentation records TypeScript, Bun, the single-file binary, Bun embedded server, and Bun React bundler as the approved stack and identifies which pieces are deferred beyond 1A
- [ ] #6 The 1A build target support matrix and local commands for type checking, testing, formatting, and compilation are documented
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. Add the minimal Bun package, TypeScript configuration, source layout, and deterministic lockfile.
2. Establish import boundaries and public entry points corresponding to the architecture groups.
3. Add the executable entry point and compiled-binary build command.
4. Document development commands, supported 1A build targets, and the approved later server and React bundling path.
5. Verify clean-clone installation and execution without a separately installed Bun runtime.
<!-- SECTION:PLAN:END -->
