---
id: TASK-395
title: Report duplicate architecture issues through groma lint
status: Done
assignee:
  - '@codex'
created_date: '2026-09-14 16:49'
updated_date: '2026-09-14 16:52'
labels: []
dependencies: []
references:
  - src-cli
  - src-architecture-findings
  - instructions
  - src-welcome
modified_files:
  - src/lint-command.ts
  - src/cli.ts
  - test-bun/lint-command.test.ts
  - docs/architecture-findings.md
  - src/instructions.ts
  - src/welcome/model.ts
type: enhancement
ordinal: 441000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Developers need one CLI entry point for architecture issues instead of a command for each rule. The first supported lint rule is the existing duplicate-operation detector. Current source exposes duplicates in scan output and Project review but has no standalone duplicates command. Keep the scope to a read-only lint command and the current duplicate rule.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 groma lint checks current evidence from configured installed scanners and reports duplicate groups with source names and file:line locations using the existing detector.
- [x] #2 The CLI exposes lint and does not expose or accept duplicates. Lint does not change saved architecture or scanner selections.
- [x] #3 Lint exits nonzero when duplicate findings or scanner failures exist; an empty result reports only the absence of findings in available scanner evidence.
- [x] #4 CLI help and shipped guidance describe lint. Focused command checks and bun run check pass.
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
1. Add a small lint command module that reads architecture ownership, collects scanner observations, and uses the existing duplicate detector and formatter without reconciliation. 2. Register lint in the CLI and document it in shipped guidance. 3. Verify the command with a disposable duplicate fixture, clean evidence, failure reporting, and unchanged architecture; run repository checks and self-review.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Implemented a 32-line lint command module: read the saved architecture model, map source ownership, collect current evidence through the existing installed-scanner registry, then call the existing duplicate detector and formatter. No reconciliation, persisted findings, new rule abstraction, or compatibility alias. OKF Markdown and C4 concepts remain unchanged; findings are temporary supporting review data. Specification and quality self-reviews passed. The concurrent CLI integration test verifies all three duplicate source locations, fresh evidence after source deletion, scanner failure output, no configured scanners, rejection of the old command name, and byte-for-byte unchanged architecture and scanner selections. CLI help exposes lint. The terminal Advanced commands screen was verified with tui-test in a disposable project; screenshot: /tmp/groma-lint-395-menu.svg. The first terminal check accidentally selected web and generated one new architecture directory; only that generated directory was removed to restore the original tree. Final bun run check passed lint and types, 16 Node tests and 315 Bun tests, with 6 existing optional native-tool skips. git diff --check passed. All changed source and test files remain below 500 lines.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Added groma lint as the single architecture issue command, with possible duplicate logic as its first rule. Reports source locations without changing saved architecture, uses installed scanners, and returns exit code 1 for findings or scanner failures. Verified command behavior, terminal discovery, unchanged storage, and the full repository check.
<!-- SECTION:FINAL_SUMMARY:END -->
