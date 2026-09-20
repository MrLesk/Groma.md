---
id: TASK-439
title: Prototype GitHub PR component review
status: Done
assignee:
  - '@codex'
created_date: '2026-09-19 10:56'
updated_date: '2026-09-19 11:08'
labels: []
dependencies: []
references:
  - web-server
  - web-page
  - map-highlights
  - render
modified_files:
  - examples/pr-review/model.ts
  - src/pull-requests/model.ts
  - src/pull-requests/github.ts
  - src/viewers/web/pull-request/session.ts
  - src/viewers/web/payload.ts
  - src/viewers/web/map-session.ts
  - src/viewers/web/pull-request/control.ts
  - src/viewers/web/page.ts
  - src/viewers/web/map-highlights.ts
  - src/viewers/web/render.ts
  - test-bun/pull-request-review.test.ts
  - docs/viewers/web/index.md
type: spike
ordinal: 512000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
A reviewer needs to see which architecture components own the files changed by one GitHub PR. Alex explicitly wants this prototype inside the existing Groma web app. Use stored architecture at the merge base and PR head with exact file evidence and no architecture writes.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Open one GitHub PR URL and show its title, compared commits, and affected components on a before/after map.
- [x] #2 Resolve additions, deletions, modifications, and renames against the appropriate snapshots; show unmapped files and incomplete or unavailable input explicitly.
- [x] #3 Provide a runnable local entry point, focused ownership tests, and documented supported assumptions.
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
1. Add GitHub PR reads and revision-specific file ownership under src, using gh and existing Git snapshot loading. 2. Add a PR control to the existing web map with before/after views, component highlights, and file evidence. 3. Verify ownership and route tests, browser flow, and repository check; perform required simplicity and complexity reviews.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Initial interpretation was a separate prototype page. Alex corrected this to integration into Groma. Only examples/pr-review/model.ts had been written; move its mapping into src and use the existing web app. Existing overlapping UI work is idle; preserve all its changes.

Real read-only GitHub verification: PR MrLesk/Groma.md#107, merge base 0e1252c92a90ef87b30d4fb5cfa56e768d436fea, head d87caff15ae4fa02943d3af8ebb7a2d3ef0d6b42, 16 changed files and 5 mapped files. Focused ownership/highlighting checks: 6 tests pass. Initial full check encountered sandbox FSEvents and ps restrictions; rerun with required OS access.

Cold simplicity review passed. Applied its optional simplification: derive affected-component count from existing groups. Browser verified PR #107 inside existing map, exact snapshot source outline, component details, and persistent PR query while selecting components.

Specification and quality review: the entry point is Open PR in the existing header; GitHub reader supplies exact comparison and files; session loads two immutable Git snapshots; mapping resolves source owners independently; existing map highlights and source APIs use the selected snapshot. No new C4 or OKF records. Browser verified Before commit 0e1252c9, After d87caff1, component selection, source file contents at that commit, and explicit invalid-URL feedback. Main map and existing task/flow changes are preserved.

Final full-context complexity review passed with no material recommendations or blockers. The separate prototype file was moved into src/pull-requests/model.ts; no separate viewer remains.

Final bun run check passed with required OS access: lint, scrollbar ownership check, TypeScript, Node suite, and Bun suite (608 passed, 35 skipped, 0 failed). Log: /tmp/groma439-check-final.log. Integrated browser demonstration remains at localhost:4751 with PR #107 open. Both required reviews passed. No commit made: awaiting user confirmation of the finished task.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Added Open PR to the existing Groma web map. A GitHub PR opens read-only merge-base/head snapshots, highlights direct file owners, groups changed files by component, and retains unmapped or absent files. Existing details and source readers use the selected commit. Verified real PR #107 in the browser, ownership/highlight tests, and the full repository check. Requires gh authentication and both commits with stored current-format Groma architecture locally.
<!-- SECTION:FINAL_SUMMARY:END -->
