---
id: TASK-13
title: Refresh observations when supported source changes
status: Done
assignee:
  - '@codex'
created_date: '2026-07-27 20:56'
updated_date: '2026-07-28 02:27'
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
1. Add a standalone source-refresh service and process entry point that watch only package.json, src/index.ts, and non-recursive src/components/*.ts, use a bounded fingerprint when fs.watch omits the filename, coalesce events with one short settle timer, and serialize full observer→emitter runs.
2. Preserve last-good generated Markdown by invoking the emitter only after a successful full observation, keep observer/emitter/fingerprint-read failures visible and recoverable, and make only watch-handle failures terminal with clean handle and timer shutdown.
3. Add disposable integration and contract tests for add/modify/remove, burst coalescing, filename-less events, exact out-of-scope filtering with zero observer/emitter calls, refresh failure recovery, byte-identical unowned observed/plans, viewer source isolation, and process shutdown.
4. Document the separate command and stable-snapshot/last-good semantics, then run focused, full, browser, syntax, and diff verification before finalizing TASK-13.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Implemented a standalone source-refresh service and process with three non-recursive watch scopes for package.json, src/index.ts, and src/components/*.ts. One 120 ms settle debounce serializes fresh observeTypeScriptSource → emitObservedComponents runs; an admitted event during a run remains pending for a later settled full refresh. The exact supported-source fingerprint handles filename-less fs.watch events without invoking the observer for unrelated changes.

Observer/emitter failures are nonterminal and preserve the last-good owned subtree. Temporary fingerprint read failures are encoded or reported and settle into normal observation so later valid events recover. A watch-handle error is terminal: all handles/timers close, the failure is reported once, and the source process exits nonzero. The viewer remains a separate Markdown-only process.

Disposable tests cover burst coalescing, filename-less supported/out-of-scope events, add/modify/remove with real filesystem watches, follow-up refresh during a run, last-good recovery, terminal watcher lifecycle, byte hashes for every unowned observed path and all plans, process shutdown, and same-document browser refresh with viewer I/O confined to groma/observed and groma/plans. Independent review found and the implementation corrected filename-less event handling, terminal dead-watcher behavior, and recoverable fingerprint-read semantics. Classification: implementation defects caught and resolved before finalization.

Fresh verification: syntax checks passed; npm run check passed architecture validation and 138/138 Node tests; npm run test:release-gate passed 5/5; npm run test:viewer:browser passed 12/12; git diff --check passed; no groma/observed or groma/plans file changed.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Added the separate bounded source-refresh process that filters exact TASK-10 paths, fingerprints only supported source for filename-less events, coalesces settled changes, serializes complete observer→emitter refreshes, preserves last-good Markdown on invalid source, and terminates cleanly on watch failure. The viewer remains source-blind and updates through its existing observed-Markdown watcher. Verified with disposable add/modify/remove and byte-hash tests, 138/138 Node tests, 5/5 release-gate tests, 12/12 browser tests, syntax/diff hygiene, and independent review with no remaining findings.
<!-- SECTION:FINAL_SUMMARY:END -->
