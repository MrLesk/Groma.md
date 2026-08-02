---
id: TASK-15
title: Remove speculative filesystem hardening from the Groma MVP
status: Done
assignee:
  - '@codex'
created_date: '2026-07-28 06:24'
updated_date: '2026-07-28 06:40'
labels:
  - simplification
  - mvp
  - filesystem
dependencies: []
references:
  - README.md
  - groma/source-observation.md
  - e2e/release-gate.spec.js
modified_files:
  - README.md
  - groma/source-observation.md
  - src/source-observer.mjs
  - src/markdown-emitter.mjs
  - src/source-refresh.mjs
  - src/source-refresh-process.mjs
  - src/viewer/markdown-watcher.mjs
  - src/viewer/reload-status.mjs
  - src/viewer/server.mjs
  - test/source-observer.test.mjs
  - test/source-observation-contract.test.mjs
  - test/markdown-emitter.test.mjs
  - test/source-refresh.test.mjs
  - test/markdown-watcher.test.mjs
  - test/reload-status.test.mjs
  - e2e/release-gate.spec.js
  - e2e/viewer.spec.js
priority: high
type: task
ordinal: 15000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Groma is moving toward an architecture model detached from the filesystem. The current filesystem-backed scan, Markdown emission, and live-view plumbing is temporary MVP infrastructure, not a subsystem to defend against adversarial races or generalize for arbitrary filesystem behavior.

Audit the implemented Revision 03 path and delete complexity whose only purpose is backward compatibility, hypothetical filesystem edge cases, generalized recovery, hostile concurrent mutation, or unsupported runtime variation. Preserve only the smallest behavior required to demonstrate the current supported happy path from the narrow source fixture through generated Markdown to the viewer. Do not design or implement the future detached replacement in this task.

The repository AGENTS.md approval boundary is authoritative. If retaining or adding any edge-case, fallback, recovery, compatibility, or hardening behavior appears necessary, report it to the orchestrator before implementation.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 The current supported happy path from the narrow source fixture through generated Markdown to the viewer still works end to end.
- [x] #2 Filesystem hardening, recovery, fallback, and race-handling code and tests without authority from the supported happy path or an explicit acceptance criterion are removed rather than generalized.
- [x] #3 The remaining implementation uses the simplest direct filesystem behavior needed by the current MVP and introduces no replacement abstraction for the planned detached architecture.
- [x] #4 Documentation states the narrow supported assumptions and does not promise behavior for removed edge cases.
- [x] #5 Relevant automated checks pass, and objective evidence identifies the deleted complexity and the retained happy-path behavior.
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
1. Simplify the source observer to direct reads of the declared narrow fixture shape, removing symlink confinement, descriptor/inode identity checks, O_NOFOLLOW runtime branching, and their tests.
2. Replace transactional generated-Markdown staging, rollback, retry cleanup, and physical-path validation with a direct rebuild of the one owned components directory while retaining canonical rendering, Comark validation, deterministic output, and preservation outside that directory.
3. Reduce source and Markdown watching to the direct supported event filters and settle behavior needed for the source→Markdown→viewer demonstration; remove fingerprint fallback, watched-directory identity/topology recovery, vanished-transaction-directory inspection, and their tests.
4. Update documentation to state the local stable-filesystem assumptions and removed guarantees, then run focused, full, and end-to-end verification before finalizing and committing TASK-15.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Implemented the Revision 03 filesystem simplification without adding a detached-model abstraction. The source observer now uses direct path.resolve/readdir/readFile calls for the narrow fixture; descriptor/inode identity checks, O_NOFOLLOW branching, realpath/lstat confinement, swap detection, and their tests are removed. The emitter validates and renders the canonical observation before directly clearing and rewriting only the owned scanner/components directory; staging, backup, rename transaction, rollback aggregation, cleanup retries, physical-path validation, and their tests are removed. Source watching now uses the three direct filename filters plus one settle queue; source fingerprints, filename-less fallback, watched-directory identities, topology termination/recovery, and associated tests are removed. The viewer watcher now reacts directly to named .md events; fingerprint scans, vanished-directory/coalesced-event inspection, and terminal watcher-error precedence are removed.

Focused red/green cleanup checks passed 44/44. The first full browser run exposed an older test that created new watched subdirectories and therefore depended on removed topology discovery; evidence showed the model never received those directory events. Under TASK-15 authority this was narrowed to Markdown add/modify/remove in existing watched directories rather than restoring fallback behavior. The targeted browser case then passed. No edge-case, fallback, recovery, compatibility, or hardening behavior required approval or was retained for this correction.

Final objective verification on the completed tree: npm run check validated all 4 architecture revisions and passed 109/109 Node tests; npm run test:release-gate passed 5/5 including the Plan 03 supported source-to-Markdown-to-open-viewer materialization flow; npm run test:viewer:browser passed 12/12; git diff --check passed. The scoped diff removes 2,488 lines and adds 190; a residual symbol scan found no O_NOFOLLOW, source topology/fingerprint seams, emitter transaction helpers, inode assertions, or vanished-directory inspection machinery.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Simplified Revision 03 to the narrow filesystem-backed MVP demonstration: direct source reads, direct owned-directory Markdown rebuilds, direct filename-filtered source watching, and direct named-Markdown viewer events. Removed descriptor/inode/O_NOFOLLOW and symlink-race hardening, transactional staging/rollback/retry cleanup, source fingerprints and topology recovery, viewer fingerprint/coalesced-directory machinery, terminal watcher precedence, and their tests; no future detached-model abstraction was introduced. README.md and groma/source-observation.md now state the stable local-filesystem assumptions and unsupported behavior. Verified the retained source fixture → canonical Markdown → already-open viewer flow with release gate 5/5, architecture validation plus 109/109 Node tests, full browser 12/12, diff hygiene, and a residual hardening-symbol scan.
<!-- SECTION:FINAL_SUMMARY:END -->
