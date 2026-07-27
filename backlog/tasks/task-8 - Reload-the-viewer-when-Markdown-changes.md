---
id: TASK-8
title: Reload the viewer when Markdown changes
status: Done
assignee:
  - '@codex'
created_date: '2026-07-27 20:55'
updated_date: '2026-07-27 23:57'
labels: []
milestone: m-1
dependencies:
  - TASK-6
references:
  - README.md
  - groma/plans/02-live-viewer/README.md
  - 'https://github.com/comarkdown/comark'
modified_files:
  - README.md
  - e2e/live-reload-fixture-server.mjs
  - e2e/viewer.spec.js
  - playwright.config.mjs
  - src/viewer/markdown-watcher.mjs
  - src/viewer/server.mjs
  - src/viewer/styles.css
  - src/viewer/viewer-app.jsx
  - test/markdown-watcher.test.mjs
  - test/viewer-server-lifecycle.test.mjs
priority: high
type: feature
ordinal: 8000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
The viewer delivered by TASK-6 reads canonical architecture only from Markdown. Add a local filesystem watcher for groma/observed and groma/plans so an open viewer rebuilds its selected model after a component document or plan README changes. The watcher observes architecture documents only in Revision 02; watching or interpreting project source code is explicitly deferred to Revision 03.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Adding, changing, or removing a component Markdown file under groma/observed or groma/plans updates the open viewer without process restart
- [x] #2 Changing a plan README updates revision title or description context without creating a C4 node
- [x] #3 Each update reparses Markdown through the TASK-4 reader and rebuilds the TASK-5 model rather than mutating canonical files
- [x] #4 Files outside groma/ do not trigger a viewer update in Revision 02
- [x] #5 The watcher introduces no source scanner or incremental reconciliation engine
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. Extract one full payload builder that loads selected and observed revisions through the TASK-4 reader, rebuilds both TASK-5 models, and derives display-only title/description from the selected root README.
2. Watch only Markdown below groma/observed and groma/plans with recursive filesystem watches and a short settle debounce; publish successful generations or retained-last-valid errors over one SSE endpoint.
3. Subscribe the React viewer to reload notifications, preserve valid focus, fall back safely when a focused container disappears, and show non-blocking invalid-edit status while retaining the last valid model.
4. Add disposable-repository browser coverage for add/change/remove, README context, outside-groma silence, transient invalid Markdown, focus recovery, process continuity, and read-only behavior; document live reload semantics.
5. Run architecture validation, unit tests, browser tests, inspect the final diff, and finalize TASK-8.

Corrective review: 6. Add deterministic browser coverage that delays an older model response past a newer generation and refuses stale payload application. 7. Persist last-good reload status/error server-side, replay status to late/reconnected clients, and clear it only after a successful full rebuild. 8. Restrict watcher scheduling to `.md` filenames for create/change/remove events and prove extensionless/non-Markdown changes inside watched roots do not advance generation. 9. Re-run disposable-fixture browser coverage, full reader/model validation, inspect canonical Markdown and worktree state, then re-finalize.

Quality review: 10. Extract the narrow filesystem-event filter into a lifecycle-owned Markdown watcher that fingerprints only `.md` files when `fs.watch` omits a filename, suppressing filename-less non-Markdown events. 11. Retain watcher handles, surface watcher errors as persistent last-valid viewer status, and close watcher handles, pending debounce/reload work, SSE streams, and the Bun server on shutdown. 12. Add deterministic watcher snapshot/error/close tests, automatic-focus browser assertion, and failure-safe fixture cleanup; repeat live-reload and full browser runs before finalization.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Implemented recursive architecture-only watches on groma/observed and groma/plans, settled full TASK-4/TASK-5 rebuilds, SSE browser notification, README-derived revision context, last-valid handling for invalid edits, and focus recovery. Browser coverage uses a disposable /tmp repository copy and exercises planned and observed add/change/remove, removed-focus fallback, README context, outside-groma silence, and invalid-edit recovery.

Verification: `npm run check` passed architecture validation plus 61 Node tests; `npm run test:viewer:browser` passed all 4 Playwright scenarios. The live-reload scenario ran against a disposable /tmp repository copy, left the project canonical Markdown untouched, and mutation-checked removed-focus recovery.

Spec review reopened the task: concurrent client fetches can regress generations, invalid-edit state is not replayed to late/reconnected clients, and extensionless watched-root events currently trigger rebuilds.

Corrective implementation: the client now rejects responses older than the latest request, announced generation, or applied generation. The server persists `reloadError`, returns it with the last-good payload, replays current status on each SSE connection, and clears it only after a successful full rebuild. Watch events schedule directly only for `.md`; rename events for possible new directories perform one delayed, single-directory Markdown check so immediate nested Markdown creation remains observable without treating known non-Markdown files as architecture. Focused Playwright tests were observed failing before each correction and passing afterward.

Corrective verification: `npm run check` passed architecture validation and 61 Node tests; `npm run test:viewer:browser` passed 7 scenarios including deterministic stale-response ordering, invalid-before-connect/status replay/reload recovery, and watched-root non-Markdown silence; `bun build src/viewer/main.jsx --outdir /tmp/groma-task8-review-build-20260728 --target browser` bundled 146 modules. `git diff --exit-code HEAD -- groma` confirmed canonical architecture unchanged, and the disposable fixture directory was removed.

Quality review reopened TASK-8: filename-less `fs.watch` events are currently discarded, watcher handles/errors lack lifecycle ownership, automatic focus recovery does not request heading focus, and the main mutation-heavy browser scenario lacks failure cleanup.

Quality correction: extracted a narrow lifecycle-owned Markdown watcher. Filename-less events recompute a SHA-256 fingerprint of only `.md` paths/content under observed/plans and notify only on fingerprint change; named non-Markdown events remain filtered. Two retained FSWatcher handles report errors without throwing, and close cancels handles, queued checks, and pending directory settlement. Server SIGINT/SIGTERM cleanup clears debounce, awaits reload work, closes SSE controllers/watchers/server, and watcher errors reuse persistent last-valid status. Automatic focus fallback now focuses the new level heading; the mutation-heavy browser scenario restores every fixture path in `finally`.

Quality verification: filename-less Markdown and non-Markdown watcher tests passed; watcher error/handle/pending-timer close test passed; real SIGTERM lifecycle test with an active SSE stream passed after mutation-checking the absent-handler failure. Live-reload/race/reconnect/filter browser scenarios passed 8/8 across two repetitions, then the full suite passed 7/7. `npm run check` passed 65 Node tests and all four architecture revisions; Bun bundled 146 modules. Canonical `groma/` remained unchanged, `git diff --check` passed, and the disposable browser fixture was removed.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Implemented the Revision 02 live viewer and all review corrections. Architecture changes are fully reread/rebuilt and generation-ordered; invalid edits and watcher errors preserve and replay last-valid status. A lifecycle-owned Markdown watcher fingerprints only `.md` files for filename-less events, filters non-Markdown changes, retains/error-handles/closes both filesystem handles, and participates in graceful server/SSE/debounce shutdown. Automatic focus recovery is accessible and browser fixture mutations always restore. Verified with 65 Node tests, repeated 8/8 focused browser cases, full 7/7 Playwright, a 146-module Bun build, clean canonical architecture, and cleaned fixtures.
<!-- SECTION:FINAL_SUMMARY:END -->
