---
id: GROM-89
title: Ignore incidental operating-system files in the canonical directory
status: To Do
assignee: []
created_date: '2026-07-20 22:00'
labels:
  - dx
  - persistence
milestone: m-5
dependencies: []
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
