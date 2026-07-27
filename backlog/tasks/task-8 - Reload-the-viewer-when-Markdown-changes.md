---
id: TASK-8
title: Reload the viewer when Markdown changes
status: Done
assignee:
  - '@codex'
created_date: '2026-07-27 20:55'
updated_date: '2026-07-27 23:44'
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
  - src/viewer/server.mjs
  - src/viewer/styles.css
  - src/viewer/viewer-app.jsx
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
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Implemented recursive architecture-only watches on groma/observed and groma/plans, settled full TASK-4/TASK-5 rebuilds, SSE browser notification, README-derived revision context, last-valid handling for invalid edits, and focus recovery. Browser coverage uses a disposable /tmp repository copy and exercises planned and observed add/change/remove, removed-focus fallback, README context, outside-groma silence, and invalid-edit recovery.

Verification: `npm run check` passed architecture validation plus 61 Node tests; `npm run test:viewer:browser` passed all 4 Playwright scenarios. The live-reload scenario ran against a disposable /tmp repository copy, left the project canonical Markdown untouched, and mutation-checked removed-focus recovery.

Spec review reopened the task: concurrent client fetches can regress generations, invalid-edit state is not replayed to late/reconnected clients, and extensionless watched-root events currently trigger rebuilds.

Corrective implementation: the client now rejects responses older than the latest request, announced generation, or applied generation. The server persists `reloadError`, returns it with the last-good payload, replays current status on each SSE connection, and clears it only after a successful full rebuild. Watch events schedule directly only for `.md`; rename events for possible new directories perform one delayed, single-directory Markdown check so immediate nested Markdown creation remains observable without treating known non-Markdown files as architecture. Focused Playwright tests were observed failing before each correction and passing afterward.

Corrective verification: `npm run check` passed architecture validation and 61 Node tests; `npm run test:viewer:browser` passed 7 scenarios including deterministic stale-response ordering, invalid-before-connect/status replay/reload recovery, and watched-root non-Markdown silence; `bun build src/viewer/main.jsx --outdir /tmp/groma-task8-review-build-20260728 --target browser` bundled 146 modules. `git diff --exit-code HEAD -- groma` confirmed canonical architecture unchanged, and the disposable fixture directory was removed.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Implemented architecture-only live reload plus spec-review corrections. The client enforces latest-request and generation ordering, the server persists/replays last-good invalid-edit status across late connections and reconnects, and watcher filtering ignores extensionless/non-Markdown files while handling immediate Markdown creation in new directories with a targeted delayed check. Verified with 61 Node tests, 7 Playwright browser scenarios, a 146-module Bun browser build, clean canonical groma diff, and cleaned temporary fixture.
<!-- SECTION:FINAL_SUMMARY:END -->
