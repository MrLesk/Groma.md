---
id: TASK-11
title: Observe the supported TypeScript source shape
status: Done
assignee:
  - '@codex'
created_date: '2026-07-27 20:56'
updated_date: '2026-07-28 01:27'
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
1. Add failing deterministic regressions that replace validated package, entry, and component paths with external symlinks at both the open-file and read-file access boundaries; each invocation must return the exact unsupported-shape error.
2. Retain bigint device/inode metadata from physical validation, open each required file with platform O_NOFOLLOW and no fallback, fstat the descriptor as a matching regular file, recheck path identity around descriptor reads, and close every handle in finally.
3. Preserve exact ordinary output, determinism, byte validation, no-plan/no-execution scope, and all prior confinement behavior; run focused/full verification, inspect the staged diff, finalize TASK-11, and commit.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Implemented the bounded observer as an exact line-oriented declaration parser with fatal UTF-8/LF validation, literal package/source-shape checks, JSON-decoded IDs/readable text, inclusive evidence ranges, and UTF-8 bytewise ordering. Added focused behavior tests for the exact oracle, empty relationships, repeated determinism, text-only execution safety, filesystem access confined to package.json/src, the documented unsupported fixture, and representative all-or-nothing violations including symlinked TypeScript paths. Focused evidence at this checkpoint: node --test test/source-observer.test.mjs passed 16/16.

Final verification: node --test test/source-observer.test.mjs passed 16/16; npm run check passed architecture validation and 92/92 Node tests; node --check src/source-observer.mjs and diff hygiene passed. The access-scope test records only package.json/src reads, accepts opaque top-level code containing a throw without execution, and confirms no Markdown access; filename/ID mismatch and unsupported fixtures reject without partial fields.

Corrective investigation after TASK-10 commit 056597b: Node TextDecoder with fatal UTF-8 but default ignoreBOM=false removes EF BB BF before parser validation; readSource rejected CR but accepted U+2028/U+2029 in opaque source; and the observer used path.resolve/readFile plus readdir, so package/src ancestors could be followed before physical confinement was established. AC #5 was reopened pending exact unsupported-shape regressions.

Corrective implementation: added complete pre-read physical validation using one supplied-root realpath, lstat/no-follow entry checks, path-component confinement, real directory/regular file enforcement, and recursive src inspection that rejects every encountered link and source-extension wrong kind. Strict byte decoding now preserves BOM visibility and rejects EF BB BF before decoding; source text rejects CR, U+2028, and U+2029 anywhere. Focused red/green evidence: five byte cases initially produced missing-rejection failures; six physical link cases exposed either acceptance or package reads before rejection; a direct component .ts directory exposed partial-looking acceptance. After the bounded fixes, node --test test/source-observer.test.mjs passed 30/30. Classification: upstream task-spec defect was the ambiguity resolved by TASK-10 commit 056597b; TASK-11 implementation defects were BOM stripping, incomplete line-separator validation, absent physical confinement, and source-path wrong-kind acceptance.

Corrective final verification: node --test test/source-observer.test.mjs passed 30/30; npm run check passed architecture validation and 108/108 Node tests; node --check src/source-observer.mjs and git diff --check passed. Exact ordinary fixture output, repeated determinism, no plan/Markdown access, and opaque project code non-execution remain covered alongside the new byte and physical-boundary cases.

TOCTOU investigation: physical validation retained only file kind strings. After validation, readUtf8 called readFile(filename), causing a second pathname resolution; the filesystem-access hook can synchronously rename the validated entry and install an external symlink immediately before that read, so valid outside bytes are accepted and attributed to the internal source range. Classification: TASK-11 implementation defect; no further upstream contract ambiguity.

TOCTOU correction implemented: physical validation now retains bigint device/inode metadata. Every package/entry/component read uses O_RDONLY|O_NOFOLLOW with no fallback, validates descriptor fstat regular type and identity, rechecks the pathname identity around reading bytes from that same descriptor, and closes the handle in finally. Six deterministic swap cases cover package, entry, and component at both open-file and read-file boundaries; valid outside bytes are rejected with the exact unsupported error. Normal access proves five successful opens and five closes, and read-boundary rejection cases prove every opened handle closes. Focused verification: 37/37.

TOCTOU regression mutation evidence: removing O_NOFOLLOW, descriptor identity comparison, and path identity checks caused all six open/read swap cases to fail with missing expected rejection while unrelated cases remained green; restoring the fix returned focused verification to 37/37. Fresh final verification: npm run check passed architecture validation and 115/115 Node tests; node --check and git diff --check passed.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Closed the remaining TASK-11 TOCTOU implementation defect. Validated bigint device/inode identity now survives physical discovery; required bytes are read only from O_NOFOLLOW descriptors whose fstat matches the validated regular file, with path identity checked around the same-descriptor read and handles closed in finally. Deterministic external-symlink swaps at open and read boundaries for package, entry, and component all return the exact unsupported error, while ordinary output, determinism, strict bytes, no-plan scope, and no execution remain unchanged. Verified with 37 focused tests, a failing security mutation, 115/115 full Node tests, architecture validation, syntax checking, and diff hygiene. Classification: implementation defect.
<!-- SECTION:FINAL_SUMMARY:END -->
