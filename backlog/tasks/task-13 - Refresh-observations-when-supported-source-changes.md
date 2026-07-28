---
id: TASK-13
title: Refresh observations when supported source changes
status: Done
assignee:
  - '@codex'
created_date: '2026-07-27 20:56'
updated_date: '2026-07-28 03:11'
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
1. Reproduce and trace the intermittent source→Markdown→viewer generation stall to its owning boundary without changing TASK-13 production behavior.
2. Classify the deterministic vanished-directory/coalesced-transaction miss as an upstream TASK-8 Markdown-watcher defect and keep TASK-13 open with AC #4 unchecked.
3. After TASK-8 correction d547981, rerun the deterministic regressions, TASK-13 focused lifecycle suite, repeated two-process source→Markdown→viewer handoff, full architecture/Node checks, release gate, and browser suite.
4. Record upstream resolution evidence, recheck AC #4, finalize TASK-13, and commit only its Backlog record.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Implemented a standalone source-refresh service and process with three non-recursive watch scopes for package.json, src/index.ts, and src/components/*.ts. One 120 ms settle debounce serializes fresh observeTypeScriptSource → emitObservedComponents runs; an admitted event during a run remains pending for a later settled full refresh. The exact supported-source fingerprint handles filename-less fs.watch events without invoking the observer for unrelated changes.

Observer/emitter failures are nonterminal and preserve the last-good owned subtree. Temporary fingerprint read failures are encoded or reported and settle into normal observation so later valid events recover. A watch-handle error is terminal: all handles/timers close, the failure is reported once, and the source process exits nonzero. The viewer remains a separate Markdown-only process.

Disposable tests cover burst coalescing, filename-less supported/out-of-scope events, add/modify/remove with real filesystem watches, follow-up refresh during a run, last-good recovery, terminal watcher lifecycle, byte hashes for every unowned observed path and all plans, process shutdown, and same-document browser refresh with viewer I/O confined to groma/observed and groma/plans. Independent review found and the implementation corrected filename-less event handling, terminal dead-watcher behavior, and recoverable fingerprint-read semantics. Classification: implementation defects caught and resolved before finalization.

Fresh verification: syntax checks passed; npm run check passed architecture validation and 138/138 Node tests; npm run test:release-gate passed 5/5; npm run test:viewer:browser passed 12/12; git diff --check passed; no groma/observed or groma/plans file changed.

External spec review found an implementation/test-seam defect: production fingerprinting encoded real non-ENOENT lstat/read/readlink/readdir failures while the regression exercised only an injected throwing seam. Corrected catches to encode only ENOENT absence/races and propagate genuine filesystem failures into the existing nonterminal report-and-observe path. Moved startup fingerprinting to a recoverable pre-watch baseline with a post-registration comparison, closing both initial-error recovery and filename-less registration races. Added real EACCES tests before and after startup plus a deferred startup fingerprint probe. Independent re-review found no remaining issues. Fresh verification: focused source-refresh tests 14/14; npm run check passed architecture validation and 141/141 Node tests; release gate 5/5; browser 12/12; syntax and diff checks passed; no observed or plan files changed. Classification: implementation/test-seam defect.

Quality review identified an implementation coverage defect: watched directories were registered once without validating that repository, src, and src/components still named the same inodes, so replacement could leave a healthy-looking watcher attached to stale topology. Corrected the lifecycle by capturing mandatory device/inode identities, validating after registration and before every filesystem event, normalizing missing/non-directory/identity-mismatch races to GROMA_SOURCE_WATCH_TOPOLOGY_CHANGED, and terminating once with all handles and timers closed. No rebinding or recovery engine was introduced. Fake-only tests now use an explicit stable identity seam; real disposable repositories cover replacement and removal of all three watched directories, while normal supported child add/modify/remove remains green.

Fresh verification: focused source-refresh tests 22/22; npm run check passed architecture validation and 149/149 Node tests; npm run test:release-gate passed 5/5; npm run test:viewer:browser passed 12/12; syntax checks and git diff --check passed; no groma/observed or groma/plans file changed. Independent re-review found no Critical, Important, or Minor issues and marked the change Ready. Classification: implementation coverage defect.

Recurring viewer-generation stall investigation (not finalized): ownership is upstream TASK-8 Markdown watcher. Baseline repetition did not implicate TASK-13/TASK-12: the focused Playwright source→Markdown→viewer test completed the server-generation handoff 99/100 times; the one failure occurred later at SVG button rendering after the generated Markdown poll and generation poll had already passed. A separate real emitter + real recursive fs.watch harness alternated 1,000 complete component replacements and received 1,000/1,000 onMarkdownChange callbacks with zero watcher errors.

A deterministic TASK-8 boundary reproducer fails 2/2. Case 1 removes a directory containing Markdown and delivers the valid recursive rename event for that directory; expected one fingerprint change, actual zero. Case 2 performs the real TASK-12 emitter transaction to final changed Markdown and delivers the coalesced rename event for the now-removed .groma-components-transaction-* directory; expected one fingerprint change, actual zero. Command: node --test /tmp/groma-task8-directory-removal-reproducer.test.mjs. Root cause: src/viewer/markdown-watcher.mjs waits 120 ms for non-.md rename events, then lines 132-146 require the changed path to still exist as a directory containing a directly nested .md file; ENOENT is silently ignored. A removed/replaced Markdown directory or a coalesced event for the emitter transaction therefore performs no bounded root fingerprint. With onMarkdownChange never called, server scheduleReload, buildPayload(generation + 1), and SSE publication are all downstream and never run, leaving generation 1 despite valid final Markdown. Node documents fs.watch as platform-dependent and does not guarantee callback filenames, so per-file .md callbacks cannot be the correctness boundary.

Classification: upstream TASK-8 implementation/test-coverage defect, consistent with the recurring intermittent integration failure. TASK-13 remains In Progress with AC #4 unchecked pending TASK-8 routing and correction. No source, emitter, viewer, polling, sleeps, coupling, or touch markers were changed.

Upstream TASK-8 defect resolved by d547981 (Detect vanished Markdown directories). The watcher now fingerprints bounded watch roots when settled directory inspection finds ENOENT, covering removed Markdown directories and coalesced events for the emitter transaction without polling, source coupling, sleeps, or touch markers. Fresh verification on current main: the two prior deterministic red reproducers pass 2/2; combined Markdown-watcher and source-refresh focused tests pass 30/30; npm run check passes architecture validation and 152/152 Node tests; npm run test:release-gate passes 5/5; npm run test:viewer:browser passes 12/12; diff hygiene is clean and no observed/plan material changed.

A fresh 50-repeat two-process source→Markdown→viewer run advanced generated Markdown and server generation in all 50 iterations, directly proving AC #4 and no watcher-event loss. Two iterations subsequently hit the separately observed React Flow button-render timeout after both handoff assertions had passed; the complete release and browser suites then passed cleanly. Classification: upstream TASK-8 implementation/test-coverage defect resolved; no further TASK-13 code change required.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Completed TASK-13 after resolving the final integration blocker in upstream TASK-8. Source refresh still performs one bounded complete observation and owned-subtree replacement, while the source-blind viewer now reliably fingerprints valid Markdown changes even when fs.watch reports a vanished directory or coalesced emitter-transaction event. Verified the upstream correction with 2/2 deterministic regressions, 30/30 focused watcher/refresh tests, 50/50 repeated generated-Markdown-to-server-generation handoffs, architecture validation and 152/152 Node tests, release gate 5/5, and browser suite 12/12. All acceptance criteria are checked. Classification: upstream TASK-8 implementation/test-coverage defect resolved; no additional TASK-13 code change was needed.
<!-- SECTION:FINAL_SUMMARY:END -->
