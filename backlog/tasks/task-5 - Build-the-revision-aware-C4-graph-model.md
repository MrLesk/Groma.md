---
id: TASK-5
title: Build the revision-aware C4 graph model
status: Done
assignee:
  - '@codex'
created_date: '2026-07-27 20:55'
updated_date: '2026-07-27 22:16'
labels: []
milestone: m-1
dependencies:
  - TASK-4
references:
  - README.md
  - groma/plans/02-live-viewer/README.md
  - 'https://c4model.com/'
modified_files:
  - src/architecture-model.mjs
  - test/architecture-model.test.mjs
priority: high
type: feature
ordinal: 5000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Consume the revision documents returned by TASK-4 and derive the deterministic application model used by every view. Groma follows the C4 model: people use software systems; a software system contains runtime containers; a container contains components. Parent IDs express containment and Markdown relationship tables express directed collaboration. Build this model independently for groma/observed or one complete directory under groma/plans; do not merge revisions or add drawing state in this task.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 The model represents people, software systems, containers, components, parent containment, external-system status, directed relationships, and source filenames
- [x] #2 Containment enforces the supported C4 hierarchy and reports duplicate IDs, unknown IDs, or invalid parents with the offending filename
- [x] #3 Relationship targets resolve through their Markdown links and stable element IDs
- [x] #4 Loading the same unchanged revision twice produces an equivalent, deterministically ordered model
- [x] #5 The model contains no coordinates, zoom, selection, colors, or other presentation state
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. Add focused failing tests for a pure revision-to-C4 model API, including C4 element fields, link-to-stable-ID relationship resolution, deterministic ordering, deep-freeze/serialization, and absence of presentation state.
2. Add failing error cases for duplicate IDs, unknown parents, invalid parent kinds, forbidden root parents, and unresolved relationship links, asserting the offending source filename.
3. Implement a framework-independent architecture model builder over TASK-4 Comark-derived revision records, with revision-local lookups and canonical ordering; do not import or couple to the standalone validator.
4. Run targeted and full validation, inspect the diff and exported model shape against every acceptance criterion, update TASK-5 evidence, finalize it, and commit the scoped change to main.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Implemented the first revision-local model slice with a red/green test cycle. The pure builder now derives frozen, JSON-serializable elements and directed relationships from TASK-4 Comark records; canonical ordering is independent of document input order. Model errors carry offending source filenames for duplicate IDs, unknown parents, invalid C4 parents, and unresolved relationship links. The runtime model does not import the standalone validator.

TDD evidence: the model suite first failed against the empty builder for graph shape, stable-ID relationship resolution, deterministic ordering, and all requested error cases; after implementation, `node --test test/architecture-model.test.mjs` passed 10/10. Final verification: `npm run check` validated all 4 revisions (35 elements, 34 relationships) and passed 31/31 tests; `git diff --check` passed. Diff review confirmed the model contains only revision, element, containment, relationship, identity, descriptive, and source-file data—no drawing or presentation state.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Added a pure, revision-local C4 graph builder over TASK-4 Comark records. It derives canonical frozen elements and directed relationships, resolves Markdown links to target stable IDs, enforces the supported C4 containment hierarchy with filename-bearing errors, and excludes presentation state. Verified with a red/green 10-test model suite plus the full repository check: 4 revisions validated and 31/31 tests passed.
<!-- SECTION:FINAL_SUMMARY:END -->
