---
id: TASK-4
title: Read architecture Markdown with Comark
status: Done
assignee:
  - '@codex'
created_date: '2026-07-27 20:55'
updated_date: '2026-07-27 22:06'
labels: []
milestone: m-1
dependencies:
  - TASK-3
references:
  - README.md
  - groma/plans/02-live-viewer/README.md
  - 'https://github.com/comarkdown/comark'
modified_files:
  - src/architecture-reader.mjs
  - test/architecture-reader.test.mjs
priority: high
type: feature
ordinal: 4000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Revision 01 establishes Groma architecture as readable component Markdown under groma/observed and complete desired snapshots under groma/plans/<revision>. Build the first runtime reader with Comark, the required TypeScript Markdown engine published as the comark npm package. Comark parses CommonMark/GFM, YAML frontmatter, and optional plain-text component syntax into a serializable AST. Use its parse API as the only Markdown parser and preserve Markdown as the only stored source; the reader must not create a second canonical JSON or graph file.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Every component document under groma/observed and groma/plans is parsed through the comark npm package
- [x] #2 Each plan README is returned as revision context and is not treated as a C4 element
- [x] #3 A parse failure stops that revision load and reports the exact repository-relative filename
- [x] #4 The reader returns Comark-derived serializable data containing document nodes, frontmatter, revision identity, and source filename, with no renderer state
- [x] #5 No second Markdown parser or persisted model format is introduced
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. Add focused reader tests that exercise real Comark parsing across observed and planned revisions, including README context separation, deterministic revision identity/source filenames, JSON serialization, and read-only results.
2. Add a malformed-frontmatter fixture proving a revision load fails with the exact repository-relative filename.
3. Implement a framework-independent ESM reader under src/ that discovers revisions and recursively parses only their Markdown sources through comark, returning no renderer or persisted model state.
4. Run targeted tests and the full project check, inspect the diff and worktree, then finalize TASK-4 with acceptance evidence and commit the scoped changes.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Implemented `loadArchitecture` and `loadRevision` as framework-independent ESM APIs. Revisions are discovered in deterministic order; each root README is parsed as revision context, while every other revision Markdown file is parsed through `comark.parse` into `{ sourceFilename, nodes, frontmatter }`. Returned data is JSON-serializable, deeply frozen, uncached, and never persisted. `ArchitectureReadError` retains revision identity and the exact repository-relative source filename.

Verification: `node --test test/architecture-reader.test.mjs` passed 3/3 reader tests. Fresh `npm run check` passed architecture validation for 4 revisions (35 elements, 34 relationships) and all 19 tests. Diff review found no renderer/graph/watch/layout code, no write path in production, and no Markdown parser besides Comark.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Added the first runtime architecture reader using locked Comark 0.5.1. It loads observed and named plan revisions, separates parsed README context from C4 documents, reports parse failures by repository-relative filename, and returns deeply frozen serializable AST/frontmatter data without renderer or persisted-model state. Verified with `npm run check`: 4 revisions validated and 19/19 tests passed.
<!-- SECTION:FINAL_SUMMARY:END -->
