---
id: GROM-46
title: Automatically blueprint Backlog.md
status: In Progress
assignee:
  - '@codex'
created_date: '2026-07-14 19:58'
updated_date: '2026-07-19 20:14'
labels: []
milestone: m-4
dependencies:
  - GROM-34
  - GROM-43
references:
  - MANIFESTO.md
  - ARCHITECTURE.md
  - 'https://github.com/MrLesk/Backlog.md'
modified_files:
  - src/host/typescript-bun-scanner.ts
  - src/host/default-bootstrap.ts
  - src/host/tests/typescript-bun-scanner.test.ts
  - src/cli/tests/scan.test.ts
  - src/host/README.md
  - groma
priority: high
type: task
ordinal: 43000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Make the clean init -> scan -> visual path produce a useful evidence-grounded blueprint for Backlog.md. The first dogfood run returned a completed but empty partial snapshot because common root .gitignore constructs invalidated the entire scope; after localizing that gap, 192 observations then exceeded an inconsistent 100-mutation publication bound even though the official host already permits 1,000 relationships. Support the common ordered ignore forms used by the project and align atomic publication with the existing finite relationship bound. Keep malformed or still-unsupported policies fail-closed. This is a first-run product slice, not a certification benchmark or generalized policy engine.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 A clean shallow Backlog.md snapshot initialized with the compiled public CLI scans to a non-empty bounded blueprint containing its package, source boundaries, public actions, dependencies, documentation, and provenance without manual correction
- [x] #2 Root .gitignore matching supports ordered negation and bounded character classes used by Backlog.md, with deterministic directory and file exclusion behavior
- [x] #3 Malformed, oversized, escaped, or still-unsupported root ignore policies remain partial and fail closed without source claims
- [x] #4 An unchanged Backlog.md rescan is byte-stable and a failed scan leaves the last complete blueprint intact
- [x] #5 The disposable source snapshot remains unchanged outside its generated groma workspace, and external dependencies remain evidence-backed components rather than inferred intent
- [x] #6 Focused scanner regression plus compiled Backlog.md dogfood and the full repository gate demonstrate the supported boundary without a benchmark scorecard or new fallback path
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. Extend the existing root ignore parser and ordered matcher only for negation and bounded character classes. 2. Add focused fixtures for Backlog-shaped policy, ordering, exclusions, determinism, and existing unsafe-policy failures. 3. Build the compiled CLI and run clean Backlog.md init, scan, bounded export, unchanged rescan, and source-tree diff checks. 4. Rescan Groma itself and inspect complexity/output changes. 5. Run the full gate and exactly two Terra xhigh reviews plus one Claude review before one ready PR.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
A clean shallow clone of Backlog.md initially completed with zero records and an empty blueprint because its root .gitignore contains ordered negations and a [0-9] class. After adding bounded ordered matching, the scanner emitted 192 records but reconciliation failed atomically at the official host’s 100 relationship-mutation limit. Aligning that limit with the existing 1,000 stored-relationship bound allowed the same compiled workflow to publish successfully without a retry or fallback.

At Backlog.md commit babd1d26d3d86a834468b256af9349b7415fda9c, clean init and scan produced 41 components (1 package, 16 source boundaries, 24 externals), 136 relationships, two defensible public actions, documentation evidence, and exact file/range fingerprints. The unchanged rescan was byte-stable at digest 6eed3e6d204b972d8b596bec7c6b23ca06f1d70b7613ae896586d08597702406. Git status showed only the generated groma/ workspace. Reconfiguring the scanner with an unsupported field produced a failed scan with exit 4; the complete 41-component, 136-relationship blueprint before and after failure was byte-identical.

Focused regressions cover ordered exclusion/re-inclusion, bounded character classes, recursive ** matching, continued failure for unsupported policy syntax, and atomic publication above 100 observed relationships with fewer than 100 components. Groma self-scan remained 51 components with only eight external automatic observations and repeated byte-stably at generation 132, digest 394c0490f67fc878fc1a815c2c4aae24022daed4a7f8d82a829b26217de94ccd.

Post-implementation full validation passed with 408 tests and 2,715 assertions plus formatting, TypeScript, architecture boundaries, build, smoke, and compiled crash recovery. After the final recursive-glob correction, Groma’s compiled self-scan advanced once to generation 133 and repeated byte-identically at digest 64aee2513f3f1646a22538453aa26588ba66fef301ae204569d7e58c3ab1ce6e.

Pre-PR review completed with exactly two independent Terra xhigh passes and one local Claude pass. The product Terra pass found no actionable issue. The correctness Terra pass found that many separated * fragments in one accepted ignore segment could trigger catastrophic regex backtracking; the parser now rejects more than two wildcards per segment, preserves Backlog’s valid *.local.* form, and has a fail-closed hostile-pattern regression. Claude found no correctness defect and suggested two low clarity fixes: the negation boolean no longer shadows ignored(), and Host documentation now says alphanumeric and underscore classes.

Post-review focused validation passed 62 tests / 765 assertions, and the complete gate passed 408 tests / 2,719 assertions plus formatting, TypeScript, architecture boundaries, build, smoke, and compiled crash recovery. The final compiled Backlog.md run remained 192 observations, 41 components, 136 relationships, two public actions, and byte-stable digest 6eed3e6d204b972d8b596bec7c6b23ca06f1d70b7613ae896586d08597702406. Final Groma self-scan advanced once to generation 134 and repeated byte-identically at digest 1c9a408fc6314cfb1ea0d8fe2498e33b0a361306b422c7984f8979a71c7662da.
<!-- SECTION:NOTES:END -->
