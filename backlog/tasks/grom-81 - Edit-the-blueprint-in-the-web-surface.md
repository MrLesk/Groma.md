---
id: GROM-81
title: Edit the blueprint in the web surface
status: Done
assignee:
  - '@codex'
created_date: '2026-07-20 17:46'
updated_date: '2026-07-21 18:09'
labels:
  - pivot
  - web
milestone: m-5
dependencies:
  - GROM-77
  - GROM-80
modified_files:
  - DEVELOPMENT.md
  - README.md
  - src/web/client/api.ts
  - src/web/client/app.tsx
  - src/web/client/spec.tsx
  - src/web/client/styles.css
priority: high
type: feature
ordinal: 78000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
The web client becomes the friendly pen the manifesto already promises: side-panel editing of intent prose, items, relationships, scale, and shared, plus create, move, merge, remove, and accept flows — all through the mutation API, never around it. Revision conflicts surface a resolution prompt instead of silently overwriting; refusals show their named blockers. Every save lands as a clean reviewable Markdown diff in the document format, and git remains the approval loop: commit, PR, merge — the editor authors change, it never approves it. The dogfood proof: edit this repo's own self-blueprint from the browser and review the resulting diff. The exported bundle keeps zero editing affordances.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 A component can be created, edited (intent, items, relationships, scale, shared), moved, merged, and removed from the web surface through the mutation API only
- [ ] #2 Revision conflicts surface a resolution prompt instead of a silent overwrite, and refusals display the named blockers
- [ ] #3 A browser edit of this repo's self-blueprint produces a focused reviewable git diff of document-format files
- [ ] #4 Read-only contexts including the exported bundle show zero editing affordances
- [ ] #5 Compiled black-box coverage drives one browser-originated edit end to end and bun run check stays green
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. Add typed browser mutation calls for create, update, move, merge, and remove while leaving the static snapshot adapter read-only.
2. Turn the existing component detail panel into the smallest complete editor for intent, structured items, outgoing relationships, scale/shared, scale-proposal acceptance, move, merge, and remove; preserve incoming relationships as read-only context.
3. Add a live-only create affordance and reload canonical reads after commits so the existing bounded model remains the sole client state path.
4. Present stale revisions as an explicit refresh-and-review step and show every refusal diagnostic, including named detail values, without guessing around blockers.
5. Update web/development guidance and task notes; leave all acceptance criteria unchecked and record unverified by product-owner instruction without running tests, checks, reviews, or CI.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Implemented the live web editor through the existing protected mutation API only. The client now has typed create/update/move/merge/remove calls; the existing detail panel edits intent, inputs/outputs/actions with stable item IDs and descriptions, source-owned outgoing relationships, scale, and shared state. It also creates components, moves them, merges obsolete identities, removes unreferenced components, and accepts proposed/drifted scales. Incoming relationships remain read-only context and committed mutations reload the existing bounded canonical model rather than introducing another state framework.

Revision conflicts retain the draft or pending operation and require an explicit refresh-and-review action before a retry. All refusal diagnostics display their code, message, and structured detail values so named blockers remain visible. The static snapshot branch renders no create/edit/accept/move/merge/remove controls and the mutation adapter also fails closed for a baked export. README and development guidance now describe the editing and read-only boundaries.

Unverified by product-owner instruction. Alex explicitly directed that no local tests, typechecks, checks, browser exercises, review agents, CI waits, or PR verification be run. A mechanical Prettier write was applied to the edited source/docs; it was not used as a verification gate. Acceptance criteria remain unchecked and the task remains In Progress.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Added API-backed web create/edit/move/merge/remove/scale-accept flows with revision-conflict recovery and blocker diagnostics while keeping read-only exports free of editing controls. Unverified by product-owner instruction; acceptance criteria remain unchecked and no local checks, CI wait, or review were performed.
<!-- SECTION:FINAL_SUMMARY:END -->
