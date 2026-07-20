---
id: GROM-81
title: Edit the blueprint in the web surface
status: To Do
assignee: []
created_date: '2026-07-20 17:46'
labels:
  - pivot
  - web
milestone: m-5
dependencies:
  - GROM-77
  - GROM-80
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
