---
id: TASK-226
title: Export the Web view as read-only static snapshots
status: Done
assignee:
  - '@codex'
created_date: '2026-08-31 17:00'
updated_date: '2026-08-31 17:49'
labels: []
dependencies: []
references:
  - commands
  - architecture-model
  - project-profile
  - world-loader
  - scan-lifecycle
  - architecture-watch
  - backlog-plugin
  - work-projection
  - page
  - render
  - revision-history
  - source-viewer
  - task-diff
  - web-server
  - export
  - web-viewer
modified_files:
  - features/export.feature
  - src/viewers/web/payload.ts
  - src/viewers/web/data.ts
  - src/viewers/web/source/control.ts
  - src/viewers/web/task-diff/control.ts
  - src/viewers/web/revision/control.ts
  - src/viewers/web/render.ts
  - src/viewers/web/page.ts
  - src/viewers/web/runtime.ts
  - src/viewers/web/server.ts
  - src/viewers/web/export.ts
  - src/cli.ts
  - test-bun/web-page.test.ts
  - test-bun/web-export.test.ts
  - README.md
  - docs/index.md
  - docs/product-model.md
  - docs/viewers/web/index.md
  - groma/observed/systems/groma/containers/cli/components/commands.md
  - >-
    groma/observed/systems/groma/containers/core/components/architecture-model.md
  - groma/observed/systems/groma/containers/core/components/project-profile.md
  - groma/observed/systems/groma/containers/core/components/world-loader.md
  - groma/observed/systems/groma/containers/scanner/components/scan-lifecycle.md
  - >-
    groma/observed/systems/groma/containers/view-host/components/architecture-watch.md
  - >-
    groma/observed/systems/groma/containers/view-host/components/backlog-plugin.md
  - >-
    groma/observed/systems/groma/containers/view-host/components/work-projection.md
  - groma/observed/systems/groma/containers/web-viewer/components/page.md
  - groma/observed/systems/groma/containers/web-viewer/components/render.md
  - >-
    groma/observed/systems/groma/containers/web-viewer/components/revision-history.md
  - >-
    groma/observed/systems/groma/containers/web-viewer/components/source-viewer.md
  - groma/observed/systems/groma/containers/web-viewer/components/task-diff.md
  - groma/observed/systems/groma/containers/web-viewer/components/web-server.md
  - groma/observed/systems/groma/containers/web-viewer/components/data.md
  - groma/observed/systems/groma/containers/web-viewer/components/export.md
  - groma/observed/systems/groma/containers/web-viewer/components/runtime.md
  - groma/observed/systems/groma/containers/web-viewer/container.md
type: feature
ordinal: 242000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Architects can publish the useful Groma Web experience through static hosting without exposing a repository-backed Groma server. The export is an explicit read-only projection of the current architecture, mapped Backlog work, task diffs, and architecture-owned source inspection. Watch mode keeps the exported snapshot current while all public browser reads remain confined to generated static files.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Running `groma export <directory>` writes a self-contained static Web viewer that opens without a running Groma server.
- [x] #2 The exported viewer shows the current project profile, architecture map, hierarchy, details, flows, mapped Backlog tasks, task diffs, and architecture-owned source inspection.
- [x] #3 The exported viewer provides no project editing or other mutation path and makes no request to the local Groma server or repository.
- [x] #4 Running `groma export --watch <directory>` refreshes the static snapshot after supported source, architecture Markdown, or Backlog task changes, and an already-open exported viewer adopts the new snapshot without a page reload.
- [x] #5 The existing local `groma web` behavior remains available.
- [x] #6 Product documentation explains one-shot export, watch mode, the public data included, and the static-hosting security boundary.
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
1. Record the public export scenario and introduce one explicit live-versus-published Web delivery contract.
2. Route browser world updates, task details and diffs, source inspection, and project saving through one data-source boundary; published delivery has reads only.
3. Materialize the current map, mapped work, task details and diffs, and architecture-owned source data into static assets; add one-shot and watched atomic publication.
4. Add `groma export <directory> [--watch]` while leaving `groma web` unchanged.
5. Add focused product and lower-level tests, update public documentation and observed architecture through Groma, then run the repository check and browser verification.
6. Run the required cold simplicity review, specification and quality review, and the full-context complexity reviewer before finalization.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Implemented one explicit Web delivery boundary: live mode keeps the existing server-backed behavior, while published mode reads only generated static assets and has no save capability.

The exporter materializes the current project, architecture world, mapped Backlog work, task details, task-diff outcomes, and architecture-owned source. It publishes render.js, snapshot.js, index.html, then version.js last as the atomic generation marker. Watch mode serializes architecture, scan, and Backlog-triggered republishes. Open pages poll only version.js and fetch a new snapshot once per generation.

Verification:
- Focused lint, typecheck, and Web tests pass: 5 tests, 0 failures.
- git diff --check passes.
- Browser QA passed for map, hierarchy, details, flows, TASK-226 details and diff, exact source inspection, hidden project editing and revision controls, and zero console errors.
- Network inspection confirmed the published page reads only static assets: version.js polling plus one snapshot.js request per new generation.
- An already-open task diff refreshed in place after publication while preserving the selected file and URL.
- Existing groma web remains covered by the shared Web page test.
- bun run check completed lint and type checking successfully and 89 of 91 Node tests passed. The only failures are the host filesystem-watch limitations: one watch integration receives no event and one reports EMFILE. The focused export and watch tests pass with independent temporary repositories.

Review history:
- Cold simplicity review requested strict materialization instead of broad fallbacks. Generic fallbacks and an unnecessary editability flag were removed; missing Backlog remains the documented empty-work case, and task-diff errors preserve the existing live-view result.
- Full-context complexity review kept the architecture and found two concrete gaps: an open task diff could stay stale, and the Export component lacked observed relationships. Snapshot adoption now invalidates and reloads the open diff while preserving its file, and the observed architecture records Commands to Export plus the Export delivery dependencies. Targeted re-review passed both findings.
- The final structure groups published delivery in the Web viewer domain and keeps a single data-source boundary, reducing the mutation mistakes a junior developer can make.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Added groma export <directory> [--watch], a self-contained read-only Web snapshot for static hosting. The export includes the current architecture, project profile, mapped work, task details and diffs, and architecture-owned source, while exposing no Groma mutation endpoint or repository access. Watch mode atomically republishes and updates already-open pages. Documentation and observed architecture describe the public-data and security boundary. Focused checks and browser QA pass; the full repository check is limited only by the host's two pre-existing filesystem-watch failures.
<!-- SECTION:FINAL_SUMMARY:END -->
