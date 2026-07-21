---
id: GROM-94
title: Scan a massive real-world TypeScript repository
status: Done
assignee:
  - '@codex'
created_date: '2026-07-21 18:18'
updated_date: '2026-07-21 18:46'
labels:
  - scanner
  - dogfood
  - scale
dependencies: []
references:
  - MANIFESTO.md
  - ARCHITECTURE.md
modified_files:
  - src/host/scanner-runtime.ts
  - src/host/typescript-bun-scanner.ts
  - src/host/tests/scanner-runtime.test.ts
  - src/host/tests/typescript-bun-scanner.test.ts
  - backlog/tasks/grom-94 - Scan-a-massive-real-world-TypeScript-repository.md
priority: high
type: bug
ordinal: 90000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Make the shortest Groma loop work on a genuinely large TypeScript codebase, using the local OpenClaw checkout at commit 635c78a1778 (4,844 JS/TS files and about 913,565 lines) as the dogfood target. The current built-in scan fails after inventory with zero observations and exposes only a generic scanner-execution-failed diagnostic. The outcome is a bounded, deterministic blueprint a human can begin to understand, not exhaustive source recovery or a larger file catalogue.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Running groma init, groma scan, and the bounded blueprint read on the stated OpenClaw revision completes without weakening scanner blindness, atomic publication, or fail-closed ambiguity
- [x] #2 The published result prioritizes architectural package and boundary structure, remains within existing canonical component and relationship bounds, and reports partial coverage when lower-level evidence is intentionally omitted
- [x] #3 A scanner refusal preserves its stable scanner code and safe explanation at the CLI instead of collapsing every scanner failure to scanner-execution-failed
- [x] #4 A repeated unchanged scan is deterministic and does not churn canonical intent or evidence
- [x] #5 Focused automated fixtures cover the observed large-repository failure mode, and a recorded real OpenClaw dogfood run includes elapsed time, peak memory, observation counts, component counts, and a brief human-readability assessment
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. Preserve a scanner's bounded, validated failure diagnostics through the execution runtime and add focused runtime coverage, so the real dogfood stop reason is visible without exposing paths or arbitrary values. 2. Re-run the exact OpenClaw revision, then change only the observed scanner budget path to publish deterministic partial architectural evidence instead of failing the whole atomic session; retain current canonical component and relationship ceilings. 3. Add the smallest synthetic fixture that reproduces that path and prove partial coverage, stable ordering, atomic failure behavior for true invalidity, and unchanged rescan byte stability. 4. Build and scan OpenClaw twice, inspect bounded roots/focus/export for human usefulness, record time, memory, observation/component counts, and run proportional repository checks. 5. Run exactly two independent Terra xhigh reviews and Claude once, resolve justified findings, open the ready PR with the exact task title, handle the first Codex review and green CI, then merge.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Baseline: OpenClaw commit 635c78a1778 contains 4,844 JS and TypeScript files and about 913,565 lines. The original scan failed in 2.02 seconds at 275,316,736-byte maximum resident set size with zero observations after exhausting the 2,000,000 extraction-work budget, while the runtime exposed only scanner-execution-failed. Implementation: preserve bounded validated scanner diagnostics; sample detailed AST evidence across package entries and source boundaries up to 256 files; yield optional details before existing record and character ceilings; recognize safe explicit pnpm workspace membership; and discard workspace containment claims when pnpm declarations are invalid or conflict with package.json. Dogfood: fresh init and scan completed with 782 observations, 212 components, 347 relationships, partial coverage, and one owned system root named openclaw whose bounded children expose workspace packages and core source boundaries. Reviews: two independent Terra xhigh passes found the same workspace ambiguity, which was fixed with conflict and malformed fixtures. Claude judged the bounded partial-scan direction ship-worthy and verified partial coverage prevents false reconciliation removals; its small budget-legibility suggestion was applied. Final verification after rebasing onto GROM-97: bun run check passed formatting, typecheck, architecture boundaries, 504 tests with 3,149 expectations, build, smoke, and the compiled Iteration 1A workflow. A pinned OpenClaw scan completed in 1.48 seconds at 375,193,600-byte maximum resident set size with 782 observations. A bounded root read returned 50 roots including exactly one owned system root. An unchanged rescan again produced 782 observations and the complete groma directory content hash remained 00a04f5a1d3072bbb8e64b7cf2322edc47ac260a40edc948deb11f4d0e91cd70. Per-kind retirement refinement and arbitrary pathological AST samples remain outside this task's explicitly pinned OpenClaw boundary.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Made the built-in scanner complete a bounded partial scan of pinned 913k-line OpenClaw by sampling detailed AST evidence across architecture boundaries, preserving existing canonical ceilings, and recognizing explicit pnpm workspace membership. Preserved safe provider diagnostics and fail-closed workspace ambiguity. Verified with 504 repository tests, the compiled workflow, two deterministic OpenClaw rescans (782 observations, 212 components, 347 relationships), a bounded root read, two Terra reviews, and one Claude review.
<!-- SECTION:FINAL_SUMMARY:END -->
