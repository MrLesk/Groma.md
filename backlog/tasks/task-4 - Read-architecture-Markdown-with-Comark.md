---
id: TASK-4
title: Read architecture Markdown with Comark
status: Done
assignee:
  - '@codex'
created_date: '2026-07-27 20:55'
updated_date: '2026-07-27 22:11'
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
  - package.json
  - package-lock.json
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
1. Add regression fixtures proving an observed revision and a plan named `observed` are both discovered and loaded from distinct source directories, and proving filesystem failures are not mislabeled as Comark parse failures.
2. Refactor revision selection to use an explicit `{ kind, name? }` descriptor, preserving unambiguous observed-versus-plan identity and exact repository-relative error metadata.
3. Narrow read, Comark parse, and serialization error handling into distinct stages while preserving the original cause.
4. Move locked Comark 0.5.1 from devDependencies to dependencies and verify it remains installed under production-only dependency selection.
5. Run targeted and full checks, review the diff, update TASK-4 evidence, finalize, and commit the correction to main.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Implemented `loadArchitecture` and `loadRevision` as framework-independent ESM APIs. Revisions are discovered in deterministic order; each root README is parsed as revision context, while every other revision Markdown file is parsed through `comark.parse` into `{ sourceFilename, nodes, frontmatter }`. Returned data is JSON-serializable, deeply frozen, uncached, and never persisted. `ArchitectureReadError` retains revision identity and the exact repository-relative source filename.

Verification: `node --test test/architecture-reader.test.mjs` passed 3/3 reader tests. Fresh `npm run check` passed architecture validation for 4 revisions (35 elements, 34 relationships) and all 19 tests. Diff review found no renderer/graph/watch/layout code, no write path in production, and no Markdown parser besides Comark.

Quality review reopened TASK-4: a discovered plan named `observed` collides with the observed revision selector; Comark is currently classified as dev-only despite being imported by runtime source; parseDocument also labels read/serialization failures as Comark parse failures.

Correction implemented after quality review. `loadRevision` now accepts an explicit revision descriptor: `{ kind: "observed" }` or `{ kind: "plan", name }`; returned plan identities use `name`, so `groma/plans/observed` cannot collide with `groma/observed`. `ArchitectureReadError.stage` distinguishes `read`, `parse`, and `serialize`, retains the repository-relative filename/revision/original cause, and only parse-stage errors use the Comark parse message. Locked `comark` 0.5.1 moved from devDependencies to dependencies with lockfile metadata updated.

TDD evidence: the expanded reader suite first failed 4 tests against the prior implementation, including duplicate observed-source loading and mislabeled filesystem errors; after correction, `node --test test/architecture-reader.test.mjs` passed 5/5. Fresh `npm run check` validated 4 revisions (35 elements, 34 relationships) and passed 21/21 tests. `npm ls comark --omit=dev` resolved `comark@0.5.1`, and `npm ci --omit=dev --dry-run` completed successfully.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Corrected revision identity so a plan named `observed` loads independently from the observed revision, split read/parse/serialization failures into accurate stages with preserved source metadata and causes, and classified locked Comark 0.5.1 as a runtime dependency. Verified by a red/green regression cycle, `npm run check` (21/21 tests; 4 revisions validated), and production-only npm dependency checks.
<!-- SECTION:FINAL_SUMMARY:END -->
