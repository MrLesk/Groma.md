---
id: TASK-379
title: Run independent release work in parallel
status: Done
assignee:
  - '@codex'
created_date: '2026-09-13 17:48'
updated_date: '2026-09-13 17:51'
labels: []
dependencies: []
modified_files:
  - .github/workflows/release.yml
  - scripts/scanner-release.ts
  - docs/scanners/publishing.md
type: chore
ordinal: 425000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
The v0.3.1 release spent about 11 minutes in a chain of jobs, including about 7 minutes building scanners on Windows. Maintainers need shorter releases by overlapping independent work while retaining successful validation and published scanner metadata as release gates.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Repository validation and the five scanner host builds can start independently; failed validation still prevents publication.
- [x] #2 Independent scanner packages build concurrently on each host and publish concurrently after the shared contract succeeds; failures prevent subsequent release steps.
- [x] #3 Groma continues embedding verified published scanner metadata, and the wrapper remains gated on all platform packages.
- [x] #4 Document the release dependencies and verify the changed orchestration plus the repository check without publishing a new release.
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
1. Remove the scanner build dependency on validation and gate scanner publication on both. 2. Run separate scanner builders concurrently, waiting for all outcomes before manifest finalization; publish the contract before concurrent scanner publication. 3. Document the retained dependency chain, validate orchestration, then run bun run check and self-review.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Changed only release orchestration and its documentation. Validation and all five host builds now start independently; scanner publication explicitly needs both. Scanner build functions write separate package directories (C# owns its separate dist directory), so they run concurrently. The shared contract remains first; scanner uploads then run concurrently. completeTogether waits for all started work and reports aggregate failures before later steps. The published npm catalog, all-platform wrapper gate, and final version-sync gate are unchanged.

Verified the actual release script using an isolated temporary fixture with mocked compiler/npm operations: stage success, stage failure, publish success, publish failure, and contract failure all passed. A barrier required all eight operations to start before any could finish, proving overlap; failures waited for all peers and prevented manifest finalization or scanner publication as applicable. No npm package was published. Parsed the workflow and simulated dependencies: validation failure blocks every publication descendant while scanner builds remain independent; publication waits for both validation and all host builds. Verification script: /tmp/groma-379-verify.ts.

Specification and quality self-reviews passed: all acceptance criteria covered, no scanner semantics or public metadata behavior changed, no extra jobs or dependencies. Full bun run check passed (16 Node tests, 300 Bun tests, 6 optional skips), log /tmp/groma-379-check.log; initial sandbox-only failures involved process inspection, FSEvents and local server access and passed with required permissions. git diff --check passed. The full check included unrelated TASK-377 working-tree changes. No hosted workflow run or timing improvement has been measured for this revision; this change does not publish another release.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Release checks and scanner host builds now overlap. Each host builds independent scanner packages concurrently, and scanners publish concurrently after the contract. Existing validation, published-metadata and platform-package gates remain. Verified concurrency and failure ordering with isolated script fixtures, workflow dependency simulation and bun run check. No new release published.
<!-- SECTION:FINAL_SUMMARY:END -->
