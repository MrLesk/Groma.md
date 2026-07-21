---
id: GROM-89
title: Ignore incidental operating-system files in the canonical directory
status: Done
assignee:
  - '@codex'
created_date: '2026-07-20 22:00'
updated_date: '2026-07-21 18:02'
labels:
  - dx
  - persistence
milestone: m-5
dependencies: []
modified_files:
  - src/persistence/markdown-intent-store.ts
  - src/persistence/local-transaction-journal.ts
  - src/persistence/README.md
  - src/persistence/tests/markdown-intent-store.test.ts
  - src/host/local-workspace.ts
  - src/host/lifecycle.ts
  - src/host/tests/application-operations-local.test.ts
  - src/cli/tests/recovery-diagnostics.test.ts
priority: high
ordinal: 85000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
On macOS, opening the workspace in Finder writes .DS_Store files into groma/, groma/components/, and groma/intent/. Every later command then fails at startup with workspace-recovery-failed or provider-snapshot-failed, and the message names neither the offending file nor the directory, so the workspace looks corrupted when it is healthy. This has interrupted dogfooding repeatedly and will hit any macOS user who so much as browses their repo. The canonical reader should ignore files that are not part of the documented canonical layout, or name the offending path so the fix is obvious.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 A .DS_Store or similar incidental operating-system file inside the canonical directory does not fail any command
- [ ] #2 A file that genuinely does not belong to the canonical layout is reported with its path in the diagnostic
- [ ] #3 bun run check stays green
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. Add a narrow canonical-layout classifier for documented incidental OS metadata, leaving all other unexpected component-tree entries fail-closed with their locator in the message and details.
2. Add persistence tests for ignored metadata and actionable unknown-file diagnostics, plus a host restart/recovery test proving incidental metadata does not block commands.
3. Run focused tests, formatting/type checks, then the full check suite and record evidence.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Implementation complete: the readable component store ignores only the documented exact incidental metadata filenames .DS_Store, Thumbs.db, and desktop.ini. Unknown component-tree resources remain fail-closed; only the validated unexpected resource kind and canonical locator are carried through local journal recovery to the CLI, while all other provider failures remain generically masked. Added persistence, restart/recovery, and CLI diagnostic regression coverage. unverified by product-owner instruction
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Implemented a narrow incidental-file allowlist and actionable unexpected-path diagnostics. Unverified by product-owner instruction; acceptance criteria remain unchecked and no further local checks, CI wait, or review were performed.
<!-- SECTION:FINAL_SUMMARY:END -->
