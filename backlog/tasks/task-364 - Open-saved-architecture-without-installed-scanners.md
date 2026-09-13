---
id: TASK-364
title: Open saved architecture without installed scanners
status: Done
assignee:
  - '@codex'
created_date: '2026-09-13 07:05'
updated_date: '2026-09-13 07:11'
labels:
  - viewers
  - scanners
dependencies: []
references:
  - TASK-362
  - terminal-host
  - web-server
  - commands
modified_files:
  - src/viewers/source/scanning.ts
  - src/cli.ts
  - src/view-host.ts
  - src/viewers/web/server.ts
  - src/viewers/web/map-session.ts
  - docs/viewers/tui/index.md
  - docs/viewers/web/index.md
  - test-bun/viewer-scanner-availability.test.ts
type: bug
ordinal: 410000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Users opening an existing Groma project must be able to read its saved architecture after the TypeScript scanner is removed or its installation is unavailable. Plain view reads records already, but interactive view and web startup require scanner loading for automatic scans and source watches. Persisted OKF/C4 data remains authoritative for viewing; scanner availability controls source refresh only. Preserve normal automatic updates when all scanners needed by the saved data are available. Do not install plugins implicitly or change explicit scan errors.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Plain and interactive groma view and groma web open existing saved architecture when TypeScript is unconfigured or configured but missing, including when another scanner remains installed.
- [x] #2 Viewer startup and source edits leave saved elements, code references and relationships unchanged when a scanner needed by that saved architecture is unavailable. Architecture-file and work updates remain active.
- [x] #3 When the required scanners are available, existing automatic scan and source-watch behavior remains supported. Explicit groma scan still rejects a configured missing scanner.
- [x] #4 Regression checks cover preserved saved data and missing scanner selection; manually verify terminal and web entry points with a disposable saved project, and run bun run check.
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
Add one viewer-owned availability check using configured scanner locations and scanner IDs on saved Code references. Skip automatic scans and source subscriptions when the saved architecture cannot be refreshed completely; keep architecture/work subscriptions and ordinary Markdown loading active. Use the same check for terminal and web startup. Leave explicit scan strict. Verify saved fixtures with absent, missing and available scanners, byte-identical stored records, both viewer entry points and repository checks.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Implemented one shared viewer availability check. Automatic scans and source watches start only when configured scanners are found and every scanner named by saved Code references is configured. Missing or removed scanners leave saved architecture intact; the existing architecture and work subscriptions remain independent. Explicit scan is unchanged and still rejects configured missing scanners. Restoring scanners and reopening resumes source refresh.

OKF/C4: saved Markdown and links remain the readable, portable architecture authority. Scanner availability is viewer refresh policy, not a new architecture element, containment rule or stored metadata field. The decision uses plugin IDs rather than TypeScript-specific behavior and applies equally to other supported scanners.

Verification: 3 concurrent regression tests cover missing TypeScript, removed TypeScript with another installed plugin, empty configuration, restored availability, byte-identical Markdown, retained Code references and relationships, and strict explicit scan errors. bun run check passed: 16 Node tests and 267 Bun tests, 6 existing native-tool skips; lint and types passed. A syntax typo in the new test was corrected before these checks.

Compiled CLI checks on a disposable saved fixture: plain view and web opened with missing and unconfigured TypeScript. Web ready/page/world responses succeeded, a source edit left saved Markdown and the served architecture unchanged, and an authored architecture edit appeared live. Initial work loading also remained active. The temporary server and native source watcher required sandbox escalation. tui-test exercised root view, container navigation and saved details with missing and unconfigured TypeScript; screenshots were captured and inspected at 120x36 and 200x60. With the real TypeScript plugin restored in a separate disposable project, scanForViewer attached source symbols and watchViewerSources processed a source edit.

Implementer specification, quality and simplicity review: entry points use the shared availability decision, then load the existing saved world; optional source subscriptions close safely while architecture/work subscriptions keep their existing lifecycle. No automatic installation, partial scan, swallowed installed-plugin error, new storage concept or compatibility path was added. All acceptance criteria and Definition of Done items have evidence; no blocking findings. This is a bounded startup fix, so no external architecture review was needed.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Both viewers open saved architecture without its scanner plugins. One shared check prevents incomplete automatic source refresh while retaining architecture and work updates. Verified with regression tests, compiled plain/web commands, interactive terminal navigation and restored TypeScript scan/watch; full repository checks passed.
<!-- SECTION:FINAL_SUMMARY:END -->
