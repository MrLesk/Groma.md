---
id: TASK-447
title: Compare Git changes through the map and revision sources
status: In Progress
assignee:
  - '@codex'
created_date: '2026-09-19 21:42'
updated_date: '2026-09-19 22:37'
labels: []
dependencies: []
references:
  - history-revisions
  - source-diff
  - screen
  - web-server
  - web-page
  - data
  - task-diff-control
  - revision-control
  - render
  - settings-control
  - map
  - shell
  - src-work-pins
  - web-export
documentation:
  - docs/git-comparison-plan.md
modified_files:
  - docs/git-comparison-plan.md
  - src/history/revisions.ts
  - src/history/git-state.ts
  - src/comparison/model.ts
  - src/comparison/project.ts
  - src/viewers/source/diff-lines.ts
  - src/viewers/tui/panes/code.ts
  - src/viewers/tui/panes/details.ts
  - src/viewers/source/diff.ts
  - src/comparison/read.ts
  - packages/revision-source/package.json
  - packages/revision-source/src/index.ts
  - package.json
  - src/history/local-source.ts
  - src/viewers/web/revision/sources.ts
  - src/history/watch.ts
  - bun.lock
  - src/viewers/web/comparison/session.ts
  - src/viewers/web/payload.ts
  - src/viewers/web/map-session.ts
  - src/viewers/web/data.ts
  - src/viewers/web/changes/view.ts
  - src/viewers/web/task-diff/view.ts
  - src/viewers/web/task-diff/control.ts
  - src/viewers/web/revision/picker.ts
  - src/viewers/web/revision/control.ts
  - src/viewers/web/revision/view.ts
  - src/viewers/web/comparison/view.ts
  - src/viewers/web/comparison/control.ts
  - src/viewers/web/atoms/theme.ts
  - src/viewers/web/iso/map.ts
  - src/viewers/web/iso/style.ts
  - src/viewers/web/page.ts
  - src/viewers/web/organisms/selection-details.ts
  - src/viewers/web/render.ts
  - test/fixtures/comparison/before/groma/index.md
  - test/fixtures/comparison/before/groma/project.md
  - test/fixtures/comparison/before/groma/systems/shop/system.md
  - >-
    test/fixtures/comparison/before/groma/systems/shop/containers/api/container.md
  - >-
    test/fixtures/comparison/before/groma/systems/shop/containers/jobs/container.md
  - >-
    test/fixtures/comparison/before/groma/systems/shop/containers/api/components/orders.md
  - >-
    test/fixtures/comparison/before/groma/systems/shop/containers/jobs/components/legacy.md
  - test/fixtures/comparison/before/groma/relationships.md
  - test/fixtures/comparison/before/src/orders.ts
  - test/fixtures/comparison/before/src/view.ts
  - test/fixtures/comparison/before/src/old.ts
  - test/fixtures/comparison/before/notes.txt
  - test/fixtures/comparison/after/groma/index.md
  - test/fixtures/comparison/after/groma/project.md
  - test/fixtures/comparison/after/groma/systems/shop/system.md
  - >-
    test/fixtures/comparison/after/groma/systems/shop/containers/api/container.md
  - >-
    test/fixtures/comparison/after/groma/systems/shop/containers/jobs/container.md
  - >-
    test/fixtures/comparison/after/groma/systems/shop/containers/jobs/components/orders.md
  - >-
    test/fixtures/comparison/after/groma/systems/shop/containers/jobs/components/notify.md
  - test/fixtures/comparison/after/groma/relationships.md
  - test/fixtures/comparison/after/src/orders.ts
  - test/fixtures/comparison/after/src/screen.ts
  - test/fixtures/comparison/after/src/notify.ts
  - test/fixtures/comparison/after/notes.txt
  - test-bun/comparison-fixture.ts
  - test-bun/git-comparison.test.ts
  - plugins/revision-sources/github/package.json
  - plugins/revision-sources/github/src/commands.ts
  - plugins/revision-sources/github/src/discovery.ts
  - plugins/revision-sources/github/src/index.ts
  - src/revision-sources.ts
  - src/viewers/web/server.ts
  - src/viewers/web/settings/revisions.ts
  - src/viewers/web/settings/control.ts
  - test-bun/github-revision-source.test.ts
  - test-bun/web-comparison-session.test.ts
  - src/viewers/web/revision/session.ts
  - test-bun/revision-navigation.test.ts
  - docs/viewers/web/git-comparison.md
  - docs/viewers/web/index.md
  - packages/revision-source/README.md
  - plugins/revision-sources/github/README.md
  - src/viewers/web/chrome/shell.ts
  - src/work/pins.ts
  - src/viewers/web/export.ts
  - src/viewers/web/url.ts
type: feature
ordinal: 516000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Developers need to review local work, branches, commits, and optional GitHub PRs in the existing map and Details pane. Implement the approved comparison plan in an isolated worktree, preserving plain working-tree and time-machine browsing and the existing Backlog work experience.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Explicit local comparisons resolve exact commit identities, preserve plain browsing, include net working-tree changes and source-only history, and never modify user branches or working files.
- [x] #2 Shared change projection and the existing map, hierarchy, and Details panes show added, edited, removed, renamed, and unmapped changes with correct ownership and immutable snapshot inputs.
- [x] #3 Task Review changes uses the shared comparison and diff experience, preserves existing task endpoint policy, and active task focus changes file scope without changing endpoints.
- [x] #4 One provider-neutral selector and Plugins settings support built-in local Git and the optional GitHub source with complete paging, search, readiness, exact commit acquisition, and discovery-only behavior.
- [ ] #5 Documented automated and browser flows pass, packaged delivery works, required reviews are complete, and a PR is opened from the isolated worktree.
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [ ] #1 Acceptance criteria have objective verification evidence.
- [x] #2 Relevant checks pass and changes remain task-scoped.
- [x] #3 Public contracts or documentation are updated when behavior changes.
- [x] #4 Implementation Plan reflects the final approach; correction history and verification are recorded in Implementation Notes.
<!-- DOD:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
Use exact Git commits and the working tree as the common states. The history domain resolves refs, reads direct differences and temporary snapshots, and publishes Git invalidation. The comparison domain maps old and new ownership and architecture identities into an immutable change result. The web comparison session owns complete results, per-side project profiles and version-bound lazy file reads; the revision control owns explicit navigation. The existing hierarchy, map and Details pane display changes, and the shared file reader also serves task Review changes. Task focus narrows files without changing versions. A browser-safe revision-source contract is injected at the application composition point; local Git is built in and the optional GitHub adapter owns discovery, authentication and exact object acquisition. Validate fixtures, browser flows, live provider reads, standalone packaging and the required reviews, then publish the isolated branch as a PR.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Implemented local exact-commit and working-tree comparison, pure ownership and architecture projection, temporary comparison worlds, shared task/Git diff readers, map colors, existing-pane controls, generic revision-source injection/settings, and the optional GitHub CLI adapter. Comparison remains supporting application state rather than OKF or C4 stored knowledge. First repository check passed (599 Bun tests, 35 skips; Node checks passed). Fifteen focused comparison/source/navigation tests passed. Browser inspection confirmed the edited component retains amber fill inside the existing green selection outline and opens the shared code diff. Live GitHub PR 108 resolved base 438e1cd8893ca7e4234dacc4187c50fe2ebd1dd9 and head c5e079ff4f1e7b043b78bc9c2be5399bf7bcdac8; shared comparison reported 29 files and 4 elements. All session-owned refs were removed after validation. Further browser, packaging, and required reviews are in progress.

Browser verification found and fixed the shared diff toolbar overlap. Active task review shows Shared and unchanged files correctly, and live file content refreshes. A completed-task review exposed a transient stale task diff while the map switched ranges; clear cached diff data before reloading. Extend the existing web-session test with direct invalidation during committed/working-tree reads and after a working-tree result: the required lifecycle rule is that committed targets ignore working-tree events and stale working-tree hunks cannot be reused. Current test only inspected a previously returned payload, so it could not detect these failures.

Cold simplicity review accepted the domain split and requested one historical snapshot load, deletion of retired web history discovery/cache/markup, and removal of unused helpers/inputs. Those reductions are applied and focused checks pass. Further browser validation passed Light, Dark and Blueprint status/selection, removed base code, ordinary exit, explicit historical-to-working-tree direction, completed-task historical review and scope clearing. Reproduced a required net working-tree failure: git rm --cached src/orders.ts leaves identical contents on disk, but readGitChanges reports deleted. Extend the existing net-working-tree test with index-only removal and a subsequent edit; it should detect a false removal or incorrect count while asserting the real index is untouched.

The net working-tree regression failed before the fix and now passes without changing Git status. Source selection review also requires session-close cancellation: add one mocked in-flight fetch case to the existing GitHub source suite, because cleanup of already-finished refs does not prove pending work is aborted. It will detect a close that hangs or leaves the selected fetch running. Live fork validation used Backlog.md PR 1023 (base 26c897d41e7862809495ce2419de93db6215b703, fork head cc187d43b37b475fe1ff905c39d2b25b7f988af3): both objects verified, common Git reader produced 14 files, the comparison engine reported the missing Groma profile explicitly, and all owned refs were cleaned.

Final review found that comparison payloads keep the live project profile even when their target is historical. The exact Before/After requirement covers the project title and overview shown on the map. Extend the existing session test with a changed live profile and assert that a committed comparison retains its historical profile; then carry each snapshot profile alongside its world. The complete check also exposed an upstream Vue test prerequisite in this fresh worktree: build the ignored Vue package before rerunning the suite.

Implementer specification and quality review completed against the five acceptance criteria and the approved plan. The selected range, Git facts, ownership projection, session payload, shared reader and map paint can be followed through their named domains. No authority-backed implementation blockers remain. Historical profile regression failed before its correction and now passes. Sixteen focused tests pass. Complete check passes: 617 Bun tests and 16 Node tests, with 35 toolchain-dependent skips; the pre-existing iso-map complexity warning remains. Browser verified current live-diff refresh and Shared on component change rows while task scope retained the base. Required final full-context complexity review and final packaging/PR publication remain.

Final full-context complexity review found no blocking issues or further material layer, concept or test to remove. It confirmed clear domain ownership, the shared task/Git reader, and the temporary OKF/C4 comparison boundary. Final repeated bun run check passed: 617 Bun tests, 16 Node tests, 35 toolchain-dependent skips. All changed source and test files are at or below 500 lines; new/changed functions meet the complexity limit. git diff --check is clean. The standalone compiled CLI starts the comparison page, and its existing selector exposes local Git plus the enabled GitHub source. No Open PR implementation remains in the web/history paths. PR publication is the remaining acceptance item.
<!-- SECTION:NOTES:END -->
