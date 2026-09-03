---
id: TASK-238.11
title: Browse revision history in the terminal
status: Done
assignee:
  - '@codex'
created_date: '2026-09-02 21:04'
updated_date: '2026-09-03 20:05'
labels:
  - tui
  - core
dependencies:
  - TASK-238.2
references:
  - web-server
  - revision-history
  - read-read
  - navigation
  - keys
  - hierarchy
  - screen
  - terminal-host
  - revisions
  - navigation-history
modified_files:
  - docs/viewers/tui/index.md
  - groma/systems/groma/containers/terminal-viewer/components/navigation.md
  - >-
    groma/systems/groma/containers/terminal-viewer/components/navigation-history.md
  - groma/systems/groma/containers/view-host/components/terminal-host.md
  - groma/systems/groma/containers/view-host/components/revisions.md
  - groma/systems/groma/containers/web-viewer/components/revision-history.md
  - src/history/git.ts
  - src/history/revisions.ts
  - src/view-host.ts
  - src/viewers/source/diff.ts
  - src/viewers/source/read.ts
  - src/viewers/source/structure.ts
  - src/viewers/tui/keys.ts
  - src/viewers/tui/model.ts
  - src/viewers/tui/navigation.ts
  - src/viewers/tui/navigation-history.ts
  - src/viewers/tui/panes/hierarchy.ts
  - src/viewers/tui/panes/view.ts
  - src/viewers/tui/terminal-viewer.ts
  - src/viewers/web/payload.ts
  - src/viewers/web/server.ts
  - src/viewers/web/url.ts
  - test-bun/git-history.test.ts
  - test-bun/tui-revision.test.ts
parent_task_id: TASK-238
priority: high
type: feature
ordinal: 273000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Pressing `h` lists in the hierarchy pane the commits of the current branch that changed the Groma directory, newest first, as the browser revision menu does; Enter loads that revision as a read-only world with no Backlog work; the header names the revision; Escape returns to Current and live updates resume. Commits without the required Groma project profile are listed but cannot be selected. Uses the core Git history reader the browser calls.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 `h` lists the revisions in the hierarchy pane, newest first, with subject, short hash and date; `h` or Escape leaves the list
- [x] #2 Enter on a revision loads its world read-only with no work markers; the header names the revision
- [x] #3 Escape from a historical world returns to Current and live updates resume
- [x] #4 Commits without the required project profile are shown as unsupported and cannot be selected
- [x] #5 Tests cover the list and the switch using a fixture repository under test/fixtures
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
1. Keep Git snapshot extraction and compatibility classification in src/history/revisions.ts so the browser and terminal consume one revision domain operation.
2. Route every terminal action through the public reduceViewer reducer, which delegates the modal revision list and historical-world restrictions to navigation-history.ts before normal map navigation.
3. Let the view host load a selected commit through the isolated snapshot reader, suppress work and live publications while historical, read source from the displayed revision, and reload Current before watchers resume.
4. Render revision metadata in the hierarchy and header, keep unsupported rows unselectable, and document the h/Escape behavior.
5. Verify ordering, unsupported selection, read-only historical loading, return to Current, resumed live updates, real TUI frames, stable architecture scans, and the complete repository suite.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Context-hunter trace: the existing Git reader already owned branch history and isolated snapshots; the browser duplicated compatibility checks; the view host owned live architecture/work boundaries; terminal navigation and hierarchy panes were pure state/presentation.

Implementation: shared compatibility moved into src/history/revisions.ts and both viewers use GromaRevision. One public terminal reducer delegates revision-list rules to the Navigation-domain navigation-history component. The host keeps only the requested revision while map.revision identifies the displayed snapshot; the viewer separately prevents duplicate asynchronous loads. Historical worlds receive empty work and revision-aware source reads. Escape reloads Current before live publishing resumes.

Simplicity review: restored complete task traceability, kept one integration test, removed duplicate selectedRevision host state, and extended the test to prove a filesystem change publishes after returning to Current. Targeted re-review passed.

Specification and quality review: all five acceptance criteria are covered; unsupported revisions remain visible and unselectable; historical source/work behavior is read-only; no task-created complexity warning remains; files stay under 500 lines.

Full-context complexity review: consolidated two reducer entry points into one public reduceViewer, shared the revision type across viewers, named the shared module and architecture component by the revisions domain, and grouped navigation-history under Navigation.

Verification: real tui-test frames at 120x36 showed the history list and historical header. Focused tests passed 28/28. bun run check passed outside the sandbox: 106 Node tests and 267 Bun tests. Two consecutive groma scan runs were stable: created 0, refreshed 101, matched 0.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Added terminal revision browsing through the shared revision reader: h opens newest-first history, unsupported commits cannot open, compatible commits load read-only without Backlog work, source reads follow the commit, and Escape restores Current plus live updates. Consolidated terminal input to one public reducer and grouped history navigation by domain. Verified with tui-test frames, 28 focused tests, stable scans, and bun run check (106 Node + 267 Bun tests).
<!-- SECTION:FINAL_SUMMARY:END -->
