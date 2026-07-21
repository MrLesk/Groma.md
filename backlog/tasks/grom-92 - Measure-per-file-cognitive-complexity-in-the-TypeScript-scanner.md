---
id: GROM-92
title: Measure per-file cognitive complexity in the TypeScript scanner
status: To Do
assignee: []
created_date: '2026-07-21 17:20'
updated_date: '2026-07-21 17:21'
labels: []
dependencies: []
ordinal: 88000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Groma is a code-topography tool: it should measure not just how files connect but how hard each is to follow. Add SonarSource Cognitive Complexity (matching the shipped JS/TS rule, eslint-plugin-sonarjs S3776) to the TypeScript/Bun scanner as a deterministic per-file scalar, emitted as raw scanner evidence. It is language-specific by construction, so it travels tagged to its scanner and is only ever compared across scanners after per-scanner normalization (a later task). This is the first instance of a general 'scanner-emitted scalar, normalized per scanner at ingestion' mechanism; surfacing it in the blueprint UI is a follow-up.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Scanner computes Cognitive Complexity per file over its own AST, deterministically (same scan yields the same number)
- [x] #2 Semantics match the SonarJS reference (per-function nesting reset, nullish counts, recursion does not), asserted against the white paper's canonical worked examples
- [x] #3 Emitted as a per-file non-negative-integer structural signal (raw evidence), not a classification, and persisted end to end
- [x] #4 bun run check stays green
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Computed in parseSource over the Babel AST (computeCognitiveComplexity), exposed as cognitiveComplexityOfSource for tooling, and emitted as a cognitiveComplexity structural signal on each non-flat file component. Follows eslint-plugin-sonarjs S3776: each function is its own scope back at nesting 0, ?? counts as a logical operator, recursion is not counted; the a??literal / a||literal default-value carve-out is intentionally not applied (a documented minor over-count). 17 tests assert the SonarSource canonical values (sumOfPrimes=7, boolean runs, nested-function reset, try/catch/finally=5, labeled jumps). Verified end to end: groma's self-scan persists the values (scanner=2026, operations=1061, cli/parser=240 in 430 LOC). Signal is dropped by reconciliation today (feeds nothing), so it lives in the evidence, not yet the web ApiComponent; surfacing it via the extensions passthrough and building per-scanner normalization are follow-ups.
<!-- SECTION:NOTES:END -->
