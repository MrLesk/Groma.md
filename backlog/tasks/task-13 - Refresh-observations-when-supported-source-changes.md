---
id: TASK-13
title: Refresh observations when supported source changes
status: Done
assignee:
  - '@codex'
created_date: '2026-07-27 20:56'
updated_date: '2026-07-28 02:36'
labels: []
milestone: m-2
dependencies:
  - TASK-8
  - TASK-11
  - TASK-12
references:
  - README.md
  - groma/README.md
  - groma/plans/03-code-observation/README.md
modified_files:
  - README.md
  - package.json
  - groma/source-observation.md
  - src/source-refresh.mjs
  - src/source-refresh-process.mjs
  - test/source-refresh.test.mjs
  - e2e/release-gate.spec.js
priority: high
type: feature
ordinal: 13000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Connect the bounded TypeScript observer from TASK-11 and the Markdown emitter from TASK-12 to local filesystem events for the exact supported source scope defined by TASK-10. After a supported source change settles, run one fresh complete observation and replace only the generated components subtree owned by the scanner/emitter under TASK-10; all hand-authored and unrelated observed elements remain untouched. Filesystem changes outside the supported source scope are ignored without invoking the observer and are not errors. The architecture viewer remains source-blind: its existing Markdown watcher from TASK-8 notices changes inside groma/observed and rebuilds the view through the normal Comark reader and C4 model.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Adding, modifying, or removing a supported source element runs one complete TASK-11 observation and refreshes only the TASK-10-owned generated components subtree through TASK-12
- [x] #2 One settled supported source change produces one complete generated subtree; no incremental graph mutation or rename reconciliation engine is introduced
- [x] #3 A filesystem change outside the TASK-10 supported source scope is ignored without invoking the observer, refreshing Markdown, or reporting an observer error
- [x] #4 The open viewer updates only because Markdown files under groma/observed changed and contains no source-observer integration
- [x] #5 Hand-authored people, systems, containers, unrelated components, and every named plan directory remain byte-identical across source refreshes
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. Add real filesystem regressions proving runtime and startup non-ENOENT fingerprint failures are reported, leave the last-good subtree unchanged, and recover on the next supported event; add a deferred startup probe for filename-less changes.
2. Narrow production fingerprint catches so only expected ENOENT absence/races are encoded, route genuine failures through recoverable reporting and settled observation, and use a pre-watch baseline plus post-registration comparison so startup events cannot be lost.
3. Run focused and full verification, record the implementation/test-seam defect correction, recheck AC #1, finalize TASK-13, and commit the focused change.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Implemented a standalone source-refresh service and process with three non-recursive watch scopes for package.json, src/index.ts, and src/components/*.ts. One 120 ms settle debounce serializes fresh observeTypeScriptSource → emitObservedComponents runs; an admitted event during a run remains pending for a later settled full refresh. The exact supported-source fingerprint handles filename-less fs.watch events without invoking the observer for unrelated changes.

Observer/emitter failures are nonterminal and preserve the last-good owned subtree. Temporary fingerprint read failures are encoded or reported and settle into normal observation so later valid events recover. A watch-handle error is terminal: all handles/timers close, the failure is reported once, and the source process exits nonzero. The viewer remains a separate Markdown-only process.

Disposable tests cover burst coalescing, filename-less supported/out-of-scope events, add/modify/remove with real filesystem watches, follow-up refresh during a run, last-good recovery, terminal watcher lifecycle, byte hashes for every unowned observed path and all plans, process shutdown, and same-document browser refresh with viewer I/O confined to groma/observed and groma/plans. Independent review found and the implementation corrected filename-less event handling, terminal dead-watcher behavior, and recoverable fingerprint-read semantics. Classification: implementation defects caught and resolved before finalization.

Fresh verification: syntax checks passed; npm run check passed architecture validation and 138/138 Node tests; npm run test:release-gate passed 5/5; npm run test:viewer:browser passed 12/12; git diff --check passed; no groma/observed or groma/plans file changed.

External spec review found an implementation/test-seam defect: production fingerprinting encoded real non-ENOENT lstat/read/readlink/readdir failures while the regression exercised only an injected throwing seam. Corrected catches to encode only ENOENT absence/races and propagate genuine filesystem failures into the existing nonterminal report-and-observe path. Moved startup fingerprinting to a recoverable pre-watch baseline with a post-registration comparison, closing both initial-error recovery and filename-less registration races. Added real EACCES tests before and after startup plus a deferred startup fingerprint probe. Independent re-review found no remaining issues. Fresh verification: focused source-refresh tests 14/14; npm run check passed architecture validation and 141/141 Node tests; release gate 5/5; browser 12/12; syntax and diff checks passed; no observed or plan files changed. Classification: implementation/test-seam defect.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Corrected TASK-13 fingerprint error semantics and startup race handling. Only ENOENT absence/races are encoded; genuine filesystem failures are reported, preserve last-good output, settle into normal observation, and recover on later supported events. Pre-watch and post-registration snapshots prevent unnamed startup changes from being lost. Verified with real runtime/startup EACCES regressions, deferred startup coverage, 141/141 Node tests, 5/5 release-gate tests, 12/12 browser tests, and independent review.
<!-- SECTION:FINAL_SUMMARY:END -->
