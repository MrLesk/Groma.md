---
id: TASK-445
title: Remove the direct Open PR integration
status: Done
assignee:
  - '@codex'
created_date: '2026-09-19 21:20'
updated_date: '2026-09-20 15:06'
labels: []
dependencies: []
references:
  - web-page
  - web-server
  - render
  - map-highlights
documentation:
  - >-
    backlog/tasks/task-463 -
    Deliver-time-machine-comparison-and-static-export.md
modified_files:
  - src/viewers/web/page.ts
  - src/viewers/web/payload.ts
  - src/viewers/web/map-session.ts
  - src/viewers/web/render.ts
  - src/viewers/web/map-highlights.ts
  - src/viewers/web/pull-request/control.ts
  - src/viewers/web/pull-request/session.ts
  - src/pull-requests/github.ts
  - src/pull-requests/model.ts
  - test-bun/pull-request-review.test.ts
  - docs/viewers/web/index.md
  - groma/systems/groma-md/containers/cli/components/github.md
  - groma/systems/groma-md/containers/export/components/control.md
  - docs/git-comparison-plan.md
type: chore
ordinal: 518000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
The Open PR feature put GitHub-specific discovery, URL state, and snapshot handling inside the Groma web app. This task removes that direct integration. Current time-machine and comparison requirements are defined in TASK-463 and its child tasks.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 The live web app has no Open PR button, dialog, PR panel, or GitHub-specific page handling.
- [x] #2 PR-only readers, payload fields, URL state, map highlighting, tests, and product documentation are removed; ordinary revision, task, flow, and component selection behavior remains intact.
- [x] #3 Stored architecture no longer describes the removed PR-only code, and the comparison plan records that the old implementation is removed.
- [x] #4 Focused existing checks and bun run check pass, and the live working-tree and revision views are verified.
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
1. Remove the PR-only browser, server, payload, highlight, and GitHub/model paths with narrow edits that preserve other tasks. 2. Remove obsolete tests and docs; update only affected stored architecture through Groma commands after coordinating its current owner. 3. Verify existing revision, task, and highlight flows, run bun run check, and review the task-scoped diff.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Removed the direct PR browser/server flow and its GitHub/model modules. Ordinary revisions use the existing revision session, and map highlights retain component neighbors, work, and flows. Removed obsolete product docs and tests. C4: the two removed implementation responsibilities no longer exist; their empty records were removed through groma remove after the live scanner cleared source evidence. OKF: no new record or metadata is introduced; ordinary architecture Markdown now describes the remaining implementation. TASK-441 owner confirmed the two record deletions are safe. TASK-446 may now add independent startup hooks to map-session.ts and opening web documentation.

Verification: the five existing selection, highlight, flow, and work test files passed (24 tests, 62 assertions). bun run check passed with exit 0, including Biome, TypeScript, Node tests, and Bun tests (607 passed, 36 skipped, 0 failed). git diff --check passed. A targeted source, test, architecture, and documentation search found no remaining direct PR integration references outside the comparison plan. Browser verification confirmed the working-tree map has no Open PR control or panel. Time-machine navigation loaded commit 1c91ffd0ff5fdbab0d19de1a5259bd0b2e61bcb4 and historical source inspection loaded plugins/scanners/csharp/dotnet/Scanner.cs from that revision. The preview is restored to the working tree. Specification review matched each acceptance criterion to these checks. Quality review compared the task files with their pre-removal snapshots, traced the remaining ordinary revision and highlight paths, and confirmed the change only subtracts the direct PR behavior while preserving concurrent task changes. No new abstraction, compatibility behavior, or test was added.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Removed the direct Open PR header control, dialog, panel, GitHub reader, PR URL/session/payload handling, and PR map highlighting. Removed their dedicated tests, obsolete product documentation, and two architecture records through Groma commands. Updated the comparison plan to record the completed removal. Existing working-tree, revision, source inspection, task, flow, and selection behavior passed focused tests, the complete repository check, and relevant browser checks.
<!-- SECTION:FINAL_SUMMARY:END -->
