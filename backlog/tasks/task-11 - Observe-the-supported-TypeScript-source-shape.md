---
id: TASK-11
title: Observe the supported TypeScript source shape
status: Done
assignee:
  - '@codex'
created_date: '2026-07-27 20:56'
updated_date: '2026-07-28 01:04'
labels: []
milestone: m-2
dependencies:
  - TASK-10
references:
  - README.md
  - groma/README.md
  - groma/plans/03-code-observation/README.md
modified_files:
  - src/source-observer.mjs
  - test/source-observer.test.mjs
priority: high
type: feature
ordinal: 11000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Implement the read-only observer defined by TASK-10 for its supported TypeScript/Bun fixture. The observer returns bounded in-memory observation evidence, not architecture Markdown: exact stable C4 component and relationship target IDs supplied by supported source declarations, entry points, component boundaries, directed relationships, and repository-relative source ranges. It must not read groma/plans, infer intent or renames, execute project code, or attempt a broader TypeScript interpretation. Direct invocation on an unsupported shape returns the single TASK-10 unsupported-shape error.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 The supported fixture yields the exact declared stable C4 IDs, entry points, component boundaries, and directed relationships required by the TASK-10 specification
- [x] #2 Every component and relationship observation includes the repository-relative file and source range that supports it
- [x] #3 Running the observer twice on unchanged source produces equivalent deterministically ordered observations
- [x] #4 The observer emits no Markdown, reads no plan directory, executes no project code, and performs no plan matching or rename inference
- [x] #5 Directly invoking the observer on the documented unsupported fixture returns the exact TASK-10 unsupported-shape error and does not fall back to partial extraction
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. Add behavior-first tests for the public observer API: exact supported fixture output and inclusive ranges, empty relationships, repeated-call determinism, read-only filesystem scope/no project execution, and the exact unsupported error with no partial result.
2. Implement a focused read-only observer in src/source-observer.mjs using fatal UTF-8 decoding, exact line-oriented declaration matching, JSON string decoding plus v1 ID/readable-text validation, source-tree/package validation, and unsigned UTF-8 bytewise ordering.
3. Add mutation cases for malformed package/source/declaration shapes and verify they collapse to the single unsupported error; run focused and full checks, inspect diff/access scope, document evidence, finalize TASK-11, and commit the bounded change.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Implemented the bounded observer as an exact line-oriented declaration parser with fatal UTF-8/LF validation, literal package/source-shape checks, JSON-decoded IDs/readable text, inclusive evidence ranges, and UTF-8 bytewise ordering. Added focused behavior tests for the exact oracle, empty relationships, repeated determinism, text-only execution safety, filesystem access confined to package.json/src, the documented unsupported fixture, and representative all-or-nothing violations including symlinked TypeScript paths. Focused evidence at this checkpoint: node --test test/source-observer.test.mjs passed 16/16.

Final verification: node --test test/source-observer.test.mjs passed 16/16; npm run check passed architecture validation and 92/92 Node tests; node --check src/source-observer.mjs and diff hygiene passed. The access-scope test records only package.json/src reads, accepts opaque top-level code containing a throw without execution, and confirms no Markdown access; filename/ID mismatch and unsupported fixtures reject without partial fields.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Implemented the groma.typescript-bun/v1 read-only observer with exact line-oriented parsing, declaration-supplied IDs, inclusive repository-relative evidence, deterministic UTF-8 bytewise ordering, and the single all-or-nothing unsupported error. It does not import or execute project code, inspect Markdown or plans, or infer broader TypeScript meaning. Verified with 16 focused observer tests, all 92 repository Node tests, architecture validation, syntax checking, and diff hygiene.
<!-- SECTION:FINAL_SUMMARY:END -->
