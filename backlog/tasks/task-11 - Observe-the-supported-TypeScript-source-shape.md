---
id: TASK-11
title: Observe the supported TypeScript source shape
status: Done
assignee:
  - '@codex'
created_date: '2026-07-27 20:56'
updated_date: '2026-07-28 01:22'
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
1. Add failing byte regressions proving package, entry, and component BOMs; U+2028/U+2029 anywhere in source text; and malformed UTF-8 all reject with the exact all-or-nothing unsupported error.
2. Add failing physical-boundary regressions proving one caller root alias is allowed while linked required files/directories, internal or escaping link targets, and any link encountered under src reject before outside bytes are read.
3. Implement pre-read physical repository validation with one supplied-root realpath, no-follow lstat checks, component-boundary containment, regular-file/directory enforcement, and complete src enumeration; preserve BOM during strict decoding and reject BOM/U+2028/U+2029 explicitly.
4. Re-run ordinary output/determinism/no-plan/no-execution coverage plus focused/full checks, inspect the staged diff, record the upstream task-spec defect separately from implementation defects, refinalize TASK-11, and commit.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Implemented the bounded observer as an exact line-oriented declaration parser with fatal UTF-8/LF validation, literal package/source-shape checks, JSON-decoded IDs/readable text, inclusive evidence ranges, and UTF-8 bytewise ordering. Added focused behavior tests for the exact oracle, empty relationships, repeated determinism, text-only execution safety, filesystem access confined to package.json/src, the documented unsupported fixture, and representative all-or-nothing violations including symlinked TypeScript paths. Focused evidence at this checkpoint: node --test test/source-observer.test.mjs passed 16/16.

Final verification: node --test test/source-observer.test.mjs passed 16/16; npm run check passed architecture validation and 92/92 Node tests; node --check src/source-observer.mjs and diff hygiene passed. The access-scope test records only package.json/src reads, accepts opaque top-level code containing a throw without execution, and confirms no Markdown access; filename/ID mismatch and unsupported fixtures reject without partial fields.

Corrective investigation after TASK-10 commit 056597b: Node TextDecoder with fatal UTF-8 but default ignoreBOM=false removes EF BB BF before parser validation; readSource rejected CR but accepted U+2028/U+2029 in opaque source; and the observer used path.resolve/readFile plus readdir, so package/src ancestors could be followed before physical confinement was established. AC #5 was reopened pending exact unsupported-shape regressions.

Corrective implementation: added complete pre-read physical validation using one supplied-root realpath, lstat/no-follow entry checks, path-component confinement, real directory/regular file enforcement, and recursive src inspection that rejects every encountered link and source-extension wrong kind. Strict byte decoding now preserves BOM visibility and rejects EF BB BF before decoding; source text rejects CR, U+2028, and U+2029 anywhere. Focused red/green evidence: five byte cases initially produced missing-rejection failures; six physical link cases exposed either acceptance or package reads before rejection; a direct component .ts directory exposed partial-looking acceptance. After the bounded fixes, node --test test/source-observer.test.mjs passed 30/30. Classification: upstream task-spec defect was the ambiguity resolved by TASK-10 commit 056597b; TASK-11 implementation defects were BOM stripping, incomplete line-separator validation, absent physical confinement, and source-path wrong-kind acceptance.

Corrective final verification: node --test test/source-observer.test.mjs passed 30/30; npm run check passed architecture validation and 108/108 Node tests; node --check src/source-observer.mjs and git diff --check passed. Exact ordinary fixture output, repeated determinism, no plan/Markdown access, and opaque project code non-execution remain covered alongside the new byte and physical-boundary cases.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Updated the groma.typescript-bun/v1 observer for the clarified TASK-10 boundary. It now validates the resolved physical repository and the complete src tree before any file read, rejects all in-scope links, escapes, and wrong kinds without partial data, preserves and rejects UTF-8 BOM bytes, and rejects CR/U+2028/U+2029 source separators while retaining exact deterministic observations for ordinary input. Regression evidence covers root aliases, required/internal/external/non-source links, pre-read failure ordering, wrong-kind component paths, BOM at all input roles, Unicode separators, malformed UTF-8, the documented unsupported fixture, no plans/Markdown, and no code execution. Classification: upstream task-spec defect resolved by 056597b; corresponding TASK-11 implementation defects corrected. Verified with 30 focused tests, 108/108 full Node tests, architecture validation, syntax checking, and diff hygiene.
<!-- SECTION:FINAL_SUMMARY:END -->
