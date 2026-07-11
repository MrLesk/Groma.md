---
id: GROM-17
title: Implement the Iteration 1A CLI and terminal entry experience
status: To Do
assignee: []
created_date: '2026-07-11 17:35'
updated_date: '2026-07-11 17:36'
labels:
  - cli
  - terminal
milestone: m-1
dependencies:
  - GROM-16
references:
  - MANIFESTO.md
  - ARCHITECTURE.md
priority: high
ordinal: 14000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Expose the complete 1A workflow through the compiled groma executable. Automation commands and the bare interactive terminal experience must call shared application operations, return bounded results, preserve deterministic machine behavior, and never access canonical files directly.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 The executable provides initialization plus group and component create, get, list, update, and explicit remove commands covering every 1A application operation
- [ ] #2 Noninteractive create and update commands accept complete or sparse structured requests from a file or standard input so agents never need private APIs or direct Markdown edits
- [ ] #3 Plain and JSON modes report stable identities, content revisions, graph generation, continuation, and typed diagnostics with documented exit-status classes
- [ ] #4 Plain mode emits no ANSI styling or prompts, and every ordinary command returns one complete bounded result page without streaming
- [ ] #5 When run in an initialized workspace on a PTY, bare groma opens a bounded aggregate terminal overview built from shared query operations and exits cleanly
- [ ] #6 When no workspace exists, bare groma clearly offers the initialization path without silently creating files
- [ ] #7 CLI and terminal tests prove that no command imports or calls Markdown-store or local-resource implementation APIs
- [ ] #8 The exact long-term plaintext grammar remains explicitly unfrozen until the Iteration 2 evidence point recorded in ARCHITECTURE.md
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. Define command parsing, structured input, renderers, exit classes, and PTY dispatch.
2. Map init and standard-model entity commands one-to-one onto shared application operations.
3. Implement deterministic plain and JSON bounded result rendering.
4. Implement the minimal aggregate terminal overview for bare groma using the same read operations.
5. Add end-to-end command, pipe, TTY, no-workspace, pagination, conflict, and error tests.
<!-- SECTION:PLAN:END -->
