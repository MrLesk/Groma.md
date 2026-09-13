---
id: TASK-333
title: Rescan affected scanners through one source watch runtime
status: Done
assignee:
  - '@codex'
created_date: '2026-09-10 19:58'
updated_date: '2026-09-10 20:15'
labels: []
dependencies: []
references:
  - scan-lifecycle
  - scan-observation
  - typescript-scanner
  - react-src-scanner-index
  - angular-src-scanner-index
  - vue-src-scanner-index
  - go-src-scanner-index
  - java-src-scanner-index
  - c-scanner
  - rust-src-scanner-index
  - adapter
  - config
modified_files:
  - src/scanner/registry.ts
  - src/scanner/source-watch.ts
  - src/scanner.ts
  - test-bun/scanner-session.test.ts
  - test-bun/source-watch.test.ts
  - docs/scanners/index.md
  - docs/scanners/creating-a-plugin.md
  - packages/scanner/src/index.ts
  - src/scanner/watch-patterns.ts
  - plugins/scanners/typescript/src/index.ts
  - plugins/scanners/react/src/index.ts
  - plugins/scanners/angular/src/index.ts
  - plugins/scanners/vue/src/index.ts
  - plugins/scanners/go/src/index.ts
  - plugins/scanners/java/src/index.ts
  - plugins/scanners/csharp/src/index.ts
  - plugins/scanners/rust/src/index.ts
  - plugins/scanners/java/src/adapter.ts
  - plugins/scanners/csharp/src/adapter.ts
  - plugins/scanners/csharp/src/config.ts
  - plugins/scanners/typescript/src/files.ts
  - test-bun/scanner-exclusions.test.ts
  - test-bun/scanner-composition.test.ts
  - test-bun/scanner-setup.test.ts
  - test-bun/scanner-modules.test.ts
  - test-bun/web-startup.test.ts
  - test-bun/scanner-evidence.test.ts
  - test-bun/csharp-scanner.test.ts
  - test-bun/rust-scanner.test.ts
type: enhancement
ordinal: 379000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Separate filesystem source watching from architecture reconciliation. A shared source runtime groups file changes, runs only subscribed scanners, and emits a complete observation set using the latest successful evidence from unaffected scanners.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 After initial collection, new and changed source or configuration paths run only matching scanners; overlapping subscriptions run all matching scanners and exclusions do not trigger scans.
- [x] #2 Each published batch contains the latest successful observation of every supported scanner; failed analysis does not publish a partial batch or update architecture.
- [x] #3 Changes during a scan are processed afterward without overlapping scans; close releases the watcher and waits for active work.
- [x] #4 The source watch runtime emits observations without reading or writing architecture records; the existing adapter reconciles observations into Markdown.
- [x] #5 Every scanner declares watch.include and watch.exclude patterns; the plugin contract and implementations contain no matchesFile callback. The shared runtime owns pattern matching.
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
Replace plugin matchesFile callbacks with watch include/exclude arrays. Compile patterns once in the shared runtime using the existing ignore library, preserving current scanner coverage and exclusions. Update all built-in plugins and test plugins, remove obsolete matcher functions, update contract documentation, and run focused plus full repository checks.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Source runtime extracted from scanner.ts; registry caches observations and schedules matching subscriptions. Initial subscription precedes baseline collection so startup edits are queued. Four session tests and three real watcher tests pass. Initial watcher tests exposed /var versus /private/var normalization after extraction; moved existing realpath handling into the source runtime and all three now pass. No test timeout was changed. Sub-agents are explicitly prohibited in this side conversation, so review is performed locally.

The full check exposed an eager-baseline regression in the supported architecture-only viewer fixture without a Git repository. Removed scanning at watch startup; the registry already marks all scanners pending for the first source event, so the first batch establishes the baseline and subsequent batches are selective. This preserves viewer startup and avoids an extra full scan on opening.

Final local specification and quality review: source watcher has no architecture reads or writes; scanner.ts owns reconciliation. Registry selection uses all matching subscriptions, so overlapping language/framework scanners both run. Latest successful observations remain scoped to one session; pending failures prevent publication and are revisited on the next relevant change. No automatic retry or persistent cache was added. Local simplicity review retained one registry cache and one shared watch scheduler, removed eager startup collection, and preserved the existing idempotent close guard. Focused final validation: 13 tests pass, including source-session selection, real watcher queues/shutdown, first edit reaching the map, and architecture-only viewer refresh.

Final repository validation passed on macOS ARM64: bun run check, 110 Node tests and 422 Bun tests; 7 optional toolchain tests skipped, zero failures. All changed functions pass the complexity limit; the six existing repository complexity warnings are unchanged. git diff --check passed. Changes remain uncommitted pending user acceptance.

User clarified that declarative watch patterns are required. Previous implementation retained matchesFile and was incomplete. Replace that contract directly; no compatibility adapter.

Full validation reproduced root-directory watcher events with an empty relative path. The shared runtime now skips these non-file events before applying patterns; previously suffix callbacks returned false, whereas the shared matcher rejects empty paths. This preserves the source-change flow without adding new scan triggers.

The npm install test reused the fixed fixture package identity from the Bun cache, loading code with the old callback contract despite serving the updated archive. Give each test its own package name derived from its owned temporary directory; this preserves the real install/restore scenario and removes cross-run cache sharing. Production installation behavior is unchanged.

Declarative contract complete: all eight scanner exports now provide watch.include/watch.exclude. Shared watch-patterns compiles root-anchored patterns once using the existing ignore dependency. Removed obsolete scanner-specific matching functions and updated test plugins. Existing C# case-insensitive coverage is represented with character-class patterns. No compatibility path remains. Focused validation: eight source-session/watch tests and six plugin installation/contract tests pass; C# and Rust subscription tests also passed. Local specification and quality review confirms the existing observation cache, failure gate, and architecture boundary remain unchanged by the contract replacement.

Final declarative-contract validation: bun run check passed on macOS ARM64 with 110 Node tests and 424 Bun tests, 7 optional toolchain skips, zero failures. git diff --check passed. No matchesFile or obsolete scanner matching helper remains in code, test sources, scripts, or scanner documentation. Local final simplicity and quality review found no scope-backed blocking issue. Changes remain uncommitted.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
All scanner plugins declare watch.include/watch.exclude patterns. One shared source runtime compiles subscriptions, groups changes, runs affected scanners, retains unaffected observations, and publishes complete evidence to the architecture adapter. Removed the matchesFile contract and scanner-specific matchers. Updated plugin fixtures and documentation. Full repository checks pass on macOS ARM64: 534 tests passed, 7 skipped.
<!-- SECTION:FINAL_SUMMARY:END -->
